-- public.review_complaints + profiles.reputation — жалобы на листы ревью → репутация → автобан
-- Depends on: profiles.sql, portfolios.sql (reviews).
-- Применяется через Supabase migrations / MCP apply_migration.

-- ---------------------------------------------------------------------------
-- profiles.reputation (клиент read-only; пишет только RPC / SQL Editor)
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists reputation integer not null default 100;

alter table public.profiles
  drop constraint if exists profiles_reputation_check;

alter table public.profiles
  add constraint profiles_reputation_check
  check (reputation >= 0);

-- Backfill на случай add column без default на старых строках (idempotent).
update public.profiles
set reputation = 100
where reputation is null;

-- Bypass для security definer RPC (автоштраф / автобан).
-- Клиентский JWT всё ещё authenticated — без флага protect_* режет UPDATE.
create or replace function public.protect_profiles_ban()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guards', true) = 'on' then
    return new;
  end if;
  if (
    new.banned_at is distinct from old.banned_at
    or new.ban_reason is distinct from old.ban_reason
  )
     and coalesce(auth.jwt() ->> 'role', 'service_role') is distinct from 'service_role' then
    raise exception 'profiles.ban fields are read-only for clients';
  end if;
  return new;
end;
$$;

create or replace function public.protect_profiles_reputation()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guards', true) = 'on' then
    return new;
  end if;
  if new.reputation is distinct from old.reputation
     and coalesce(auth.jwt() ->> 'role', 'service_role') is distinct from 'service_role' then
    raise exception 'profiles.reputation is read-only for clients';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_reputation on public.profiles;
create trigger profiles_protect_reputation
  before update on public.profiles
  for each row
  execute function public.protect_profiles_reputation();

-- ---------------------------------------------------------------------------
-- review_complaints
-- ---------------------------------------------------------------------------

create table if not exists public.review_complaints (
  id uuid primary key default gen_random_uuid(),
  review_id uuid not null references public.reviews (id) on delete cascade,
  reporter_id uuid not null references auth.users (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  tags text[] not null,
  penalty integer not null check (penalty > 0),
  created_at timestamptz not null default now(),
  constraint review_complaints_one_per_reporter unique (review_id, reporter_id),
  constraint review_complaints_tags_nonempty check (cardinality(tags) >= 1)
);

create index if not exists review_complaints_reviewer_id_idx
  on public.review_complaints (reviewer_id);

create index if not exists review_complaints_reporter_id_idx
  on public.review_complaints (reporter_id);

create index if not exists review_complaints_review_id_idx
  on public.review_complaints (review_id);

alter table public.review_complaints enable row level security;

-- Автор портфолио видит свои жалобы (без чужих). Ревьюер — ничего (анонимность).
drop policy if exists "review_complaints_select_own" on public.review_complaints;
create policy "review_complaints_select_own"
  on public.review_complaints for select
  to authenticated
  using (reporter_id = auth.uid());

-- INSERT только через RPC (revoke direct insert).
revoke all on table public.review_complaints from public;
revoke all on table public.review_complaints from anon;
grant select on table public.review_complaints to authenticated;

-- ---------------------------------------------------------------------------
-- Серверный конфиг весов / порога (не отдаём клиенту как SoT)
-- ---------------------------------------------------------------------------
-- Старт reputation = 100; вес тега = 20; штраф жалобы = max(весов);
-- бан при reputation <= 0. Пять независимых жалоб → автобан.

create or replace function public.review_complaint_tag_weight(tag text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case tag
    when 'low_effort' then 20
    when 'spam' then 20
    when 'harassment' then 20
    when 'offensive' then 20
    when 'irrelevant' then 20
    else null
  end;
$$;

create or replace function public.review_complaint_ban_threshold()
returns integer
language sql
immutable
set search_path = public
as $$
  select 0;
$$;

-- ---------------------------------------------------------------------------
-- RPC: submit_review_complaint
-- ---------------------------------------------------------------------------

create or replace function public.submit_review_complaint(
  p_review_id uuid,
  p_tags text[]
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  r public.reviews;
  p public.portfolios;
  tag text;
  seen text[] := '{}'::text[];
  clean_tags text[] := '{}'::text[];
  w integer;
  penalty integer := 0;
  new_rep integer;
  already_banned boolean;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if public.is_profile_banned(uid) then
    raise exception 'reporter_banned';
  end if;

  if p_review_id is null then
    raise exception 'review_required';
  end if;

  if p_tags is null or cardinality(p_tags) < 1 then
    raise exception 'tags_required';
  end if;

  foreach tag in array p_tags
  loop
    tag := lower(trim(tag));
    if tag = '' then
      continue;
    end if;
    w := public.review_complaint_tag_weight(tag);
    if w is null then
      raise exception 'invalid_tag';
    end if;
    if tag = any (seen) then
      continue;
    end if;
    seen := array_append(seen, tag);
    clean_tags := array_append(clean_tags, tag);
    if w > penalty then
      penalty := w;
    end if;
  end loop;

  if cardinality(clean_tags) < 1 or penalty <= 0 then
    raise exception 'tags_required';
  end if;

  select * into r
  from public.reviews
  where id = p_review_id;

  if not found then
    raise exception 'review_not_found';
  end if;

  select * into p
  from public.portfolios
  where id = r.portfolio_id;

  if not found then
    raise exception 'portfolio_not_found';
  end if;

  if p.owner_id is distinct from uid then
    raise exception 'not_portfolio_owner';
  end if;

  if r.reviewer_id = uid then
    raise exception 'cannot_complain_own_review';
  end if;

  if exists (
    select 1
    from public.review_complaints c
    where c.review_id = p_review_id
      and c.reporter_id = uid
  ) then
    raise exception 'complaint_already_exists';
  end if;

  perform set_config('app.bypass_profile_guards', 'on', true);

  insert into public.review_complaints (
    review_id,
    reporter_id,
    reviewer_id,
    tags,
    penalty
  )
  values (
    p_review_id,
    uid,
    r.reviewer_id,
    clean_tags,
    penalty
  );

  select banned_at is not null into already_banned
  from public.profiles
  where id = r.reviewer_id
  for update;

  if not found then
    raise exception 'reviewer_profile_not_found';
  end if;

  update public.profiles
  set
    reputation = greatest(0, reputation - penalty),
    banned_at = case
      when already_banned then banned_at
      when greatest(0, reputation - penalty) <= public.review_complaint_ban_threshold()
        then now()
      else banned_at
    end,
    ban_reason = case
      when already_banned then ban_reason
      when greatest(0, reputation - penalty) <= public.review_complaint_ban_threshold()
        then coalesce(nullif(ban_reason, ''), 'reputation')
      else ban_reason
    end
  where id = r.reviewer_id
  returning reputation into new_rep;

  return jsonb_build_object(
    'ok', true,
    'review_id', p_review_id,
    'tags', to_jsonb(clean_tags),
    'penalty', penalty,
    'reviewer_reputation', new_rep,
    'reviewer_banned', new_rep <= public.review_complaint_ban_threshold()
  );
end;
$$;

revoke all on function public.submit_review_complaint(uuid, text[]) from public;
revoke all on function public.submit_review_complaint(uuid, text[]) from anon;
grant execute on function public.submit_review_complaint(uuid, text[]) to authenticated;

revoke all on function public.review_complaint_tag_weight(text) from public;
revoke all on function public.review_complaint_tag_weight(text) from anon;
revoke all on function public.review_complaint_tag_weight(text) from authenticated;

revoke all on function public.review_complaint_ban_threshold() from public;
revoke all on function public.review_complaint_ban_threshold() from anon;
revoke all on function public.review_complaint_ban_threshold() from authenticated;
