-- public.review_claims — жёсткий claim слота при открытии /review
-- + answers на reviews; слоты-аватарки; RPC claim/heartbeat/release
-- Depends on public.portfolios / public.reviews / public.profiles
--   (apply portfolios.sql + profiles.sql first).

-- Ответы квиза + денормализованный аватар ревьюера (для слотов / отчёта).
alter table public.reviews
  add column if not exists answers jsonb;

alter table public.reviews
  add column if not exists reviewer_avatar_url text;

alter table public.reviews
  add column if not exists reviewer_display_name text;

create table if not exists public.review_claims (
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  claimed_at timestamptz not null default now(),
  expires_at timestamptz not null,
  reviewer_avatar_url text,
  reviewer_display_name text,
  primary key (portfolio_id, reviewer_id),
  constraint review_claims_expires_after_claim
    check (expires_at > claimed_at)
);

create index if not exists review_claims_expires_at_idx
  on public.review_claims (expires_at);

create index if not exists review_claims_reviewer_id_idx
  on public.review_claims (reviewer_id);

-- TTL claim (20 минут).
create or replace function public.review_claim_ttl()
returns interval
language sql
immutable
set search_path = public
as $$
  select interval '20 minutes';
$$;

create or replace function public.purge_expired_review_claims()
returns void
language sql
security definer
set search_path = public
as $$
  delete from public.review_claims
  where expires_at <= now();
$$;

create or replace function public.claim_portfolio_review(p_portfolio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.portfolios;
  live_others integer;
  own_live boolean;
  ttl interval := public.review_claim_ttl();
  avatar text;
  display text;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if public.is_profile_banned(uid) then
    raise exception 'profile_banned';
  end if;

  perform public.purge_expired_review_claims();

  select * into p
  from public.portfolios
  where id = p_portfolio_id
  for update;

  if not found then
    raise exception 'portfolio_not_found';
  end if;

  if p.owner_id = uid then
    raise exception 'cannot_review_own_portfolio';
  end if;

  if p.status <> 'pending' then
    raise exception 'portfolio_not_pending';
  end if;

  if not public.can_review_portfolio(p.owner_id, uid) then
    raise exception 'review_league_mismatch';
  end if;

  if exists (
    select 1
    from public.reviews r
    where r.portfolio_id = p.id
      and r.reviewer_id = uid
  ) then
    raise exception 'already_reviewed';
  end if;

  select exists (
    select 1
    from public.review_claims c
    where c.portfolio_id = p.id
      and c.reviewer_id = uid
      and c.expires_at > now()
  ) into own_live;

  select count(*)::integer into live_others
  from public.review_claims c
  where c.portfolio_id = p.id
    and c.reviewer_id <> uid
    and c.expires_at > now();

  if not own_live and (p.reviews_count + live_others) >= p.target_reviews then
    raise exception 'no_slots';
  end if;

  select
    nullif(trim(pr.avatar_url), ''),
    nullif(trim(pr.display_name), '')
  into avatar, display
  from public.profiles pr
  where pr.id = uid;

  insert into public.review_claims as c (
    portfolio_id,
    reviewer_id,
    claimed_at,
    expires_at,
    reviewer_avatar_url,
    reviewer_display_name
  )
  values (
    p.id,
    uid,
    now(),
    now() + ttl,
    avatar,
    display
  )
  on conflict (portfolio_id, reviewer_id) do update
  set
    claimed_at = excluded.claimed_at,
    expires_at = excluded.expires_at,
    reviewer_avatar_url = coalesce(
      excluded.reviewer_avatar_url,
      c.reviewer_avatar_url
    ),
    reviewer_display_name = coalesce(
      excluded.reviewer_display_name,
      c.reviewer_display_name
    );
end;
$$;

create or replace function public.heartbeat_portfolio_claim(p_portfolio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ttl interval := public.review_claim_ttl();
  updated integer;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  perform public.purge_expired_review_claims();

  update public.review_claims
  set expires_at = now() + ttl
  where portfolio_id = p_portfolio_id
    and reviewer_id = uid
    and expires_at > now();

  get diagnostics updated = row_count;
  if updated = 0 then
    raise exception 'claim_not_found';
  end if;
end;
$$;

create or replace function public.release_portfolio_claim(p_portfolio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  delete from public.review_claims
  where portfolio_id = p_portfolio_id
    and reviewer_id = uid;
end;
$$;

-- Слоты аватаров: completed (reviews) + active (claims). Только если caller видит портфолио.
create or replace function public.portfolio_reviewer_slots(p_ids uuid[])
returns table (
  portfolio_id uuid,
  slot_kind text,
  reviewer_id uuid,
  avatar_url text,
  display_name text,
  occupied_at timestamptz
)
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null or p_ids is null or cardinality(p_ids) = 0 then
    return;
  end if;

  perform public.purge_expired_review_claims();

  return query
  with visible as (
    select p.id
    from public.portfolios p
    where p.id = any (p_ids)
      and (
        p.owner_id = uid
        or (
          p.status = 'pending'
          and public.can_review_portfolio(p.owner_id, uid)
        )
      )
  ),
  completed as (
    select
      r.portfolio_id,
      'completed'::text as slot_kind,
      r.reviewer_id,
      coalesce(
        nullif(trim(r.reviewer_avatar_url), ''),
        nullif(trim(pr.avatar_url), '')
      ) as avatar_url,
      coalesce(
        nullif(trim(r.reviewer_display_name), ''),
        nullif(trim(pr.display_name), '')
      ) as display_name,
      r.created_at as occupied_at
    from public.reviews r
    join visible v on v.id = r.portfolio_id
    left join public.profiles pr on pr.id = r.reviewer_id
  ),
  active as (
    select
      c.portfolio_id,
      'active'::text as slot_kind,
      c.reviewer_id,
      coalesce(
        nullif(trim(c.reviewer_avatar_url), ''),
        nullif(trim(pr.avatar_url), '')
      ) as avatar_url,
      coalesce(
        nullif(trim(c.reviewer_display_name), ''),
        nullif(trim(pr.display_name), '')
      ) as display_name,
      c.claimed_at as occupied_at
    from public.review_claims c
    join visible v on v.id = c.portfolio_id
    left join public.profiles pr on pr.id = c.reviewer_id
    where c.expires_at > now()
  )
  select * from completed
  union all
  select * from active
  order by 1, 2 desc, 6;
end;
$$;

-- Триггер: claim обязателен; инкремент; снять claim; avatar из профиля если пусто.
create or replace function public.handle_review_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.portfolios;
  avatar text;
  display text;
begin
  select * into p
  from public.portfolios
  where id = new.portfolio_id
  for update;

  if not found then
    raise exception 'portfolio_not_found';
  end if;

  if p.owner_id = new.reviewer_id then
    raise exception 'cannot_review_own_portfolio';
  end if;

  if p.status <> 'pending' then
    raise exception 'portfolio_not_pending';
  end if;

  if not public.can_review_portfolio(p.owner_id, new.reviewer_id) then
    raise exception 'review_league_mismatch';
  end if;

  if not exists (
    select 1
    from public.review_claims c
    where c.portfolio_id = new.portfolio_id
      and c.reviewer_id = new.reviewer_id
      and c.expires_at > now()
  ) then
    raise exception 'review_claim_required';
  end if;

  if new.reviewer_avatar_url is null or nullif(trim(new.reviewer_avatar_url), '') is null
     or new.reviewer_display_name is null or nullif(trim(new.reviewer_display_name), '') is null
  then
    select
      nullif(trim(pr.avatar_url), ''),
      nullif(trim(pr.display_name), '')
    into avatar, display
    from public.profiles pr
    where pr.id = new.reviewer_id;

    if new.reviewer_avatar_url is null or nullif(trim(new.reviewer_avatar_url), '') is null then
      new.reviewer_avatar_url := avatar;
    end if;
    if new.reviewer_display_name is null or nullif(trim(new.reviewer_display_name), '') is null then
      new.reviewer_display_name := display;
    end if;
  end if;

  update public.portfolios
  set
    reviews_count = p.reviews_count + 1,
    status = case
      when p.reviews_count + 1 >= p.target_reviews then 'done'
      else p.status
    end
  where id = new.portfolio_id;

  delete from public.review_claims
  where portfolio_id = new.portfolio_id
    and reviewer_id = new.reviewer_id;

  return new;
end;
$$;

-- BEFORE INSERT — чтобы заполнить avatar до записи и проверить claim.
drop trigger if exists reviews_after_insert on public.reviews;
drop trigger if exists reviews_before_insert on public.reviews;

create trigger reviews_before_insert
  before insert on public.reviews
  for each row
  execute function public.handle_review_inserted();

alter table public.review_claims enable row level security;

drop policy if exists "review_claims_select_visible" on public.review_claims;
create policy "review_claims_select_visible"
  on public.review_claims for select
  to authenticated
  using (
    exists (
      select 1
      from public.portfolios p
      where p.id = portfolio_id
        and (
          p.owner_id = auth.uid()
          or (
            p.status = 'pending'
            and public.can_review_portfolio(p.owner_id, auth.uid())
          )
        )
    )
  );

-- Mutations только через RPC (security definer).
revoke all on table public.review_claims from anon;
revoke all on table public.review_claims from authenticated;
grant select on table public.review_claims to authenticated;

-- Автор портфолио читает полученные ревью (для будущего report); ревьюер — свои.
drop policy if exists "reviews_select_own" on public.reviews;
drop policy if exists "reviews_select_reviewer_or_owner" on public.reviews;
create policy "reviews_select_reviewer_or_owner"
  on public.reviews for select
  to authenticated
  using (
    reviewer_id = auth.uid()
    or exists (
      select 1
      from public.portfolios p
      where p.id = portfolio_id
        and p.owner_id = auth.uid()
    )
  );

grant execute on function public.review_claim_ttl() to authenticated;
grant execute on function public.purge_expired_review_claims() to authenticated;
grant execute on function public.claim_portfolio_review(uuid) to authenticated;
grant execute on function public.heartbeat_portfolio_claim(uuid) to authenticated;
grant execute on function public.release_portfolio_claim(uuid) to authenticated;
grant execute on function public.portfolio_reviewer_slots(uuid[]) to authenticated;

revoke all on function public.handle_review_inserted() from public;
revoke all on function public.handle_review_inserted() from anon;
revoke all on function public.handle_review_inserted() from authenticated;
