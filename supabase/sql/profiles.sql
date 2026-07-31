-- public.profiles — продуктовый профиль 1:1 с auth.users
-- Применяется через Supabase migrations / MCP apply_migration.

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  auth_provider text,
  display_name text,
  avatar_url text,
  telegram_id bigint unique,
  telegram_username text,
  email text,
  role text,
  grade text,
  -- Optional free-text workplace from /settings (not a league/auth field).
  workplace text,
  -- Membership: free (default) / pro (paid) / legendary (manual VIP). Not onboarding `role`.
  tier text not null default 'free' check (tier in ('free', 'pro', 'legendary')),
  domains text[] not null default '{}'::text[],
  goals text[] not null default '{}'::text[],
  onboarding jsonb not null default '{}'::jsonb,
  onboarding_done boolean not null default false,
  balance integer not null default 0 check (balance >= 0),
  -- Referral: personal invite code (max 2 redemptions). See sql/referrals.sql.
  referral_code text,
  referred_by uuid references public.profiles (id) on delete set null,
  referral_uses integer not null default 0 check (referral_uses >= 0 and referral_uses <= 2),
  referral_entry_code text,
  -- Moderation: non-null banned_at ⇒ account locked (ban-screen). Clients cannot write.
  banned_at timestamptz,
  ban_reason text,
  -- Reviewer reputation (complaints → auto-ban). Clients cannot write; see review_complaints.sql.
  -- default 0, floor −100 (ban threshold). Full RPC in review_complaints.sql.
  reputation integer not null default 0 check (reputation >= -100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists profiles_telegram_id_idx on public.profiles (telegram_id);
create index if not exists profiles_auth_provider_idx on public.profiles (auth_provider);
create index if not exists profiles_tier_idx on public.profiles (tier);
create index if not exists profiles_banned_at_idx
  on public.profiles (banned_at)
  where banned_at is not null;

-- Idempotent for DBs created before `tier` existed.
alter table public.profiles
  add column if not exists tier text not null default 'free';

alter table public.profiles
  drop constraint if exists profiles_tier_check;

alter table public.profiles
  add constraint profiles_tier_check
  check (tier in ('free', 'pro', 'legendary'));

-- Idempotent for DBs created before ban columns existed.
alter table public.profiles
  add column if not exists banned_at timestamptz;

alter table public.profiles
  add column if not exists ban_reason text;

-- Idempotent for DBs created before reputation existed (RPC in review_complaints.sql).
alter table public.profiles
  add column if not exists reputation integer not null default 0;

alter table public.profiles
  alter column reputation set default 0;

alter table public.profiles
  drop constraint if exists profiles_reputation_check;

alter table public.profiles
  add constraint profiles_reputation_check
  check (reputation >= -100);

-- Idempotent for DBs created before referral columns existed (full RPCs in referrals.sql).
alter table public.profiles
  add column if not exists referral_code text;

alter table public.profiles
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

alter table public.profiles
  add column if not exists referral_uses integer not null default 0;

alter table public.profiles
  add column if not exists referral_entry_code text;

-- Optional workplace from /settings.
alter table public.profiles
  add column if not exists workplace text;

-- Sanitize before CHECK constraints (idempotent; keeps apply safe on live data).
update public.profiles
set workplace = left(workplace, 120)
where workplace is not null and char_length(workplace) > 120;

update public.profiles
set display_name = left(display_name, 80)
where display_name is not null and char_length(display_name) > 80;

update public.profiles
set telegram_username = null
where telegram_username is not null
  and telegram_username !~ '^[A-Za-z0-9_]{5,32}$';

update public.profiles
set role = 'other'
where role is not null
  and role not in (
    'web-designer',
    'product-designer',
    'emotional-designer',
    'ux-ui-designer',
    'other'
  );

alter table public.profiles
  drop constraint if exists profiles_workplace_len_check;

alter table public.profiles
  add constraint profiles_workplace_len_check
  check (workplace is null or char_length(workplace) <= 120);

alter table public.profiles
  drop constraint if exists profiles_display_name_len_check;

alter table public.profiles
  add constraint profiles_display_name_len_check
  check (display_name is null or char_length(display_name) <= 80);

alter table public.profiles
  drop constraint if exists profiles_role_check;

alter table public.profiles
  add constraint profiles_role_check
  check (
    role is null
    or role in (
      'web-designer',
      'product-designer',
      'emotional-designer',
      'ux-ui-designer',
      'other'
    )
  );

alter table public.profiles
  drop constraint if exists profiles_telegram_username_check;

alter table public.profiles
  add constraint profiles_telegram_username_check
  check (
    telegram_username is null
    or telegram_username ~ '^[A-Za-z0-9_]{5,32}$'
  );

create or replace function public.set_profiles_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute function public.set_profiles_updated_at();

-- Clients cannot self-escalate tier; service_role / SQL editor can.
create or replace function public.protect_profiles_tier()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  -- No JWT (SQL Editor) or service_role → allow; authenticated/anon clients → deny.
  if new.tier is distinct from old.tier
     and coalesce(auth.jwt() ->> 'role', 'service_role') is distinct from 'service_role' then
    raise exception 'profiles.tier is read-only for clients';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_tier on public.profiles;
create trigger profiles_protect_tier
  before update on public.profiles
  for each row
  execute function public.protect_profiles_tier();

-- Clients cannot self-ban / self-unban; service_role / SQL editor can.
-- RPC auto-ban sets app.bypass_profile_guards=on (see review_complaints.sql).
create or replace function public.protect_profiles_ban()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guards', true) = 'on' then
    return new;
  end if;
  -- No JWT (SQL Editor) or service_role → allow; authenticated/anon clients → deny.
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

drop trigger if exists profiles_protect_ban on public.profiles;
create trigger profiles_protect_ban
  before update on public.profiles
  for each row
  execute function public.protect_profiles_ban();

-- Clients cannot self-edit reputation; service_role / SQL editor / bypass RPC can.
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

-- Clients cannot self-credit balance; RPC / review trigger use bypass GUC.
create or replace function public.protect_profiles_balance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guards', true) = 'on' then
    return new;
  end if;
  if new.balance is distinct from old.balance
     and coalesce(auth.jwt() ->> 'role', 'service_role') is distinct from 'service_role' then
    raise exception 'profiles.balance is read-only for clients';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_balance on public.profiles;
create trigger profiles_protect_balance
  before update on public.profiles
  for each row
  execute function public.protect_profiles_balance();

-- Grade: only before onboarding_done (or service_role / SQL Editor).
-- Role may change later from /settings (whitelist CHECK + client allowlist).
create or replace function public.protect_profiles_grade()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guards', true) = 'on' then
    return new;
  end if;
  if new.grade is distinct from old.grade
     and coalesce(old.onboarding_done, false) is true
     and coalesce(auth.jwt() ->> 'role', 'service_role') is distinct from 'service_role' then
    raise exception 'profiles.grade locked after onboarding';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_grade on public.profiles;
create trigger profiles_protect_grade
  before update on public.profiles
  for each row
  execute function public.protect_profiles_grade();

-- Identity + onboarding lock: clients cannot spoof Auth fields or reopen grade lock.
create or replace function public.protect_profiles_identity()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guards', true) = 'on' then
    return new;
  end if;
  if coalesce(auth.jwt() ->> 'role', 'service_role') = 'service_role' then
    return new;
  end if;
  if new.email is distinct from old.email
     or new.telegram_id is distinct from old.telegram_id
     or new.auth_provider is distinct from old.auth_provider
     or new.created_at is distinct from old.created_at then
    raise exception 'profiles.identity fields are read-only for clients';
  end if;
  if coalesce(old.onboarding_done, false) is true
     and new.onboarding_done is distinct from true then
    raise exception 'profiles.onboarding_done cannot be cleared by clients';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_identity on public.profiles;
create trigger profiles_protect_identity
  before update on public.profiles
  for each row
  execute function public.protect_profiles_identity();

-- Used by portfolios/reviews RLS (security definer — no recursive RLS on profiles).
-- Client oracle: only reports ban for auth.uid(); other uid → false (no leak).
create or replace function public.is_profile_banned(uid uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and (uid is null or uid = auth.uid())
      and p.banned_at is not null
  );
$$;

revoke all on function public.is_profile_banned(uuid) from public;
revoke all on function public.is_profile_banned(uuid) from anon;
grant execute on function public.is_profile_banned(uuid) to authenticated;

-- Trigger-only: не вызывать через PostgREST RPC.
revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  meta jsonb := coalesce(new.raw_user_meta_data, '{}'::jsonb);
  app_meta jsonb := coalesce(new.raw_app_meta_data, '{}'::jsonb);
  tg_id bigint;
  new_code text;
begin
  -- telegram_id only from app_metadata (Edge / service_role), not user_metadata.
  begin
    tg_id := nullif(app_meta->>'telegram_id', '')::bigint;
  exception when others then
    tg_id := null;
  end;

  -- generate_referral_code lives in referrals.sql; fallback if not yet applied.
  begin
    new_code := public.generate_referral_code();
  exception when undefined_function then
    new_code := upper(substr(replace(new.id::text, '-', ''), 1, 10));
  end;

  insert into public.profiles (
    id,
    auth_provider,
    display_name,
    avatar_url,
    telegram_id,
    telegram_username,
    email,
    referral_code
  )
  values (
    new.id,
    coalesce(
      nullif(meta->>'provider', ''),
      nullif(app_meta->>'provider', ''),
      'email'
    ),
    nullif(
      coalesce(
        meta->>'full_name',
        meta->>'name',
        meta->>'first_name',
        meta->>'username',
        split_part(coalesce(new.email, ''), '@', 1)
      ),
      ''
    ),
    coalesce(meta->>'avatar_url', meta->>'photo_url', meta->>'picture'),
    tg_id,
    nullif(meta->>'username', ''),
    new.email,
    new_code
  )
  on conflict (id) do update set
    auth_provider = excluded.auth_provider,
    display_name = coalesce(excluded.display_name, public.profiles.display_name),
    avatar_url = coalesce(excluded.avatar_url, public.profiles.avatar_url),
    telegram_id = coalesce(excluded.telegram_id, public.profiles.telegram_id),
    telegram_username = coalesce(excluded.telegram_username, public.profiles.telegram_username),
    email = coalesce(excluded.email, public.profiles.email),
    referral_code = coalesce(public.profiles.referral_code, excluded.referral_code),
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

alter table public.profiles enable row level security;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

drop policy if exists "profiles_update_own" on public.profiles;
create policy "profiles_update_own"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

revoke all on table public.profiles from anon;
revoke all on table public.profiles from public;
grant select on table public.profiles to authenticated;
-- Column-level UPDATE: only product fields the client may write.
-- Identity / economy / moderation / referral / timestamps stay non-updatable via grant.
revoke update on table public.profiles from authenticated;
grant update (
  display_name,
  avatar_url,
  telegram_username,
  role,
  grade,
  workplace,
  domains,
  goals,
  onboarding,
  onboarding_done
) on table public.profiles to authenticated;

revoke all on function public.protect_profiles_balance() from public;
revoke all on function public.protect_profiles_balance() from anon;
revoke all on function public.protect_profiles_balance() from authenticated;
revoke all on function public.protect_profiles_grade() from public;
revoke all on function public.protect_profiles_grade() from anon;
revoke all on function public.protect_profiles_grade() from authenticated;
revoke all on function public.protect_profiles_identity() from public;
revoke all on function public.protect_profiles_identity() from anon;
revoke all on function public.protect_profiles_identity() from authenticated;
