-- public.portfolios + public.reviews — общая очередь портфолио и факты ревью
-- Применяется через Supabase migrations / MCP apply_migration.
-- Depends on public.is_profile_banned() from profiles.sql (apply profiles first).

create table if not exists public.portfolios (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users (id) on delete cascade,
  url text not null,
  name text,
  role text,
  avatar_url text,
  target_reviews integer not null default 3
    check (target_reviews > 0),
  reviews_count integer not null default 0
    check (reviews_count >= 0),
  status text not null default 'pending'
    check (status in ('pending', 'done', 'skipped')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint portfolios_reviews_within_target
    check (reviews_count <= target_reviews)
);

create index if not exists portfolios_status_created_idx
  on public.portfolios (status, created_at desc);
create index if not exists portfolios_owner_id_idx
  on public.portfolios (owner_id);

create table if not exists public.reviews (
  id uuid primary key default gen_random_uuid(),
  portfolio_id uuid not null references public.portfolios (id) on delete cascade,
  reviewer_id uuid not null references auth.users (id) on delete cascade,
  answers jsonb,
  reviewer_avatar_url text,
  reviewer_display_name text,
  created_at timestamptz not null default now(),
  constraint reviews_portfolio_reviewer_unique unique (portfolio_id, reviewer_id)
);
-- Claim-слоты, RPC и BEFORE-триггер с проверкой claim: см. review_claims.sql

create index if not exists reviews_reviewer_id_idx
  on public.reviews (reviewer_id);
create index if not exists reviews_portfolio_id_idx
  on public.reviews (portfolio_id);

create or replace function public.set_portfolios_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists portfolios_set_updated_at on public.portfolios;
create trigger portfolios_set_updated_at
  before update on public.portfolios
  for each row
  execute function public.set_portfolios_updated_at();

-- Лиги матчинга (тихий фильтр). Grade → league; кто кого может ревьюить.
-- 1 junior | 2 middle | 3 senior/lead/head
-- junior→junior; middle→junior+middle; senior+→middle+senior+
create or replace function public.profile_grade(uid uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select p.grade from public.profiles p where p.id = uid;
$$;

create or replace function public.grade_league(grade text)
returns integer
language sql
immutable
set search_path = public
as $$
  select case grade
    when 'junior' then 1
    when 'middle' then 2
    when 'senior' then 3
    when 'lead' then 3
    when 'head' then 3
    else null
  end;
$$;

create or replace function public.can_review_grades(reviewer_grade text, owner_grade text)
returns boolean
language sql
immutable
set search_path = public
as $$
  select
    public.grade_league(reviewer_grade) is not null
    and public.grade_league(owner_grade) is not null
    and (
      (public.grade_league(reviewer_grade) = 1 and public.grade_league(owner_grade) = 1)
      or (public.grade_league(reviewer_grade) = 2 and public.grade_league(owner_grade) in (1, 2))
      or (public.grade_league(reviewer_grade) = 3 and public.grade_league(owner_grade) in (2, 3))
    );
$$;

create or replace function public.can_review_portfolio(
  portfolio_owner_id uuid,
  reviewer_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    public.can_review_grades(
      public.profile_grade(reviewer_id),
      public.profile_grade(portfolio_owner_id)
    ),
    false
  );
$$;

-- После insert ревью: self / pending / лига; инкремент счётчика; done при цели.
-- Актуальная версия (claim required, BEFORE INSERT, answers/avatar): review_claims.sql
create or replace function public.handle_review_inserted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  p public.portfolios;
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

  update public.portfolios
  set
    reviews_count = p.reviews_count + 1,
    status = case
      when p.reviews_count + 1 >= p.target_reviews then 'done'
      else p.status
    end
  where id = new.portfolio_id;

  return new;
end;
$$;

drop trigger if exists reviews_after_insert on public.reviews;
create trigger reviews_after_insert
  after insert on public.reviews
  for each row
  execute function public.handle_review_inserted();

-- ВАЖНО: после этого файла всегда применяйте review_claims.sql
-- (заменит триггер на BEFORE + проверку claim).

alter table public.portfolios enable row level security;
alter table public.reviews enable row level security;

-- Лента: свои всегда; чужие pending — только в лиге ревьюера.
drop policy if exists "portfolios_select_feed" on public.portfolios;
create policy "portfolios_select_feed"
  on public.portfolios for select
  to authenticated
  using (
    owner_id = auth.uid()
    or (
      status = 'pending'
      and public.can_review_portfolio(owner_id, auth.uid())
    )
  );

drop policy if exists "portfolios_insert_own" on public.portfolios;
create policy "portfolios_insert_own"
  on public.portfolios for insert
  to authenticated
  with check (
    owner_id = auth.uid()
    and not public.is_profile_banned(auth.uid())
    and status = 'pending'
    and reviews_count = 0
    and target_reviews = 3
  );

-- Счётчик/статус обновляет только security definer trigger.
-- Актуальная SELECT-политика (reviewer + owner): review_claims.sql
drop policy if exists "reviews_select_own" on public.reviews;
create policy "reviews_select_own"
  on public.reviews for select
  to authenticated
  using (reviewer_id = auth.uid());

drop policy if exists "reviews_insert_own" on public.reviews;
create policy "reviews_insert_own"
  on public.reviews for insert
  to authenticated
  with check (
    reviewer_id = auth.uid()
    and not public.is_profile_banned(auth.uid())
    and exists (
      select 1
      from public.portfolios p
      where p.id = portfolio_id
        and p.status = 'pending'
        and p.owner_id <> auth.uid()
        and public.can_review_portfolio(p.owner_id, auth.uid())
    )
  );

grant select, insert on public.portfolios to authenticated;
grant select, insert on public.reviews to authenticated;

revoke all on table public.portfolios from anon;
revoke all on table public.portfolios from public;
revoke all on table public.reviews from anon;
revoke all on table public.reviews from public;

-- profile_grade is an oracle if callable by clients; keep for internal definer use only.
revoke all on function public.profile_grade(uuid) from public;
revoke all on function public.profile_grade(uuid) from anon;
revoke all on function public.profile_grade(uuid) from authenticated;

grant execute on function public.grade_league(text) to authenticated;
grant execute on function public.can_review_grades(text, text) to authenticated;
grant execute on function public.can_review_portfolio(uuid, uuid) to authenticated;

-- Trigger-only: не вызывать через PostgREST RPC.
revoke all on function public.set_portfolios_updated_at() from public;
revoke all on function public.set_portfolios_updated_at() from anon;
revoke all on function public.set_portfolios_updated_at() from authenticated;

revoke all on function public.handle_review_inserted() from public;
revoke all on function public.handle_review_inserted() from anon;
revoke all on function public.handle_review_inserted() from authenticated;
