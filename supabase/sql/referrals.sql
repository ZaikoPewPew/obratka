-- Referrals: один персональный код на профиль, лимит 2 активации.
-- Seed-код для холодного старта (не привязан к юзеру).
-- Применять через migrations / MCP apply_migration / SQL Editor.

-- ---------------------------------------------------------------------------
-- Columns on profiles
-- ---------------------------------------------------------------------------

alter table public.profiles
  add column if not exists referral_code text;

alter table public.profiles
  add column if not exists referred_by uuid references public.profiles (id) on delete set null;

alter table public.profiles
  add column if not exists referral_uses integer not null default 0;

alter table public.profiles
  add column if not exists referral_entry_code text;

alter table public.profiles
  drop constraint if exists profiles_referral_uses_check;

alter table public.profiles
  add constraint profiles_referral_uses_check
  check (referral_uses >= 0 and referral_uses <= 2);

create unique index if not exists profiles_referral_code_uidx
  on public.profiles (referral_code)
  where referral_code is not null;

create index if not exists profiles_referred_by_idx
  on public.profiles (referred_by)
  where referred_by is not null;

-- ---------------------------------------------------------------------------
-- Seed codes (bootstrap gate, not a user)
-- ---------------------------------------------------------------------------

create table if not exists public.referral_seed_codes (
  code text primary key,
  max_uses integer not null default 100 check (max_uses > 0),
  uses integer not null default 0 check (uses >= 0),
  created_at timestamptz not null default now(),
  constraint referral_seed_codes_uses_lte_max check (uses <= max_uses)
);

alter table public.referral_seed_codes enable row level security;

-- No direct client access; only via security definer RPCs.
revoke all on table public.referral_seed_codes from public;
revoke all on table public.referral_seed_codes from anon;
revoke all on table public.referral_seed_codes from authenticated;

insert into public.referral_seed_codes (code, max_uses, uses)
values ('YTHWKPDWAK', 100, 0)
on conflict (code) do nothing;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------

create or replace function public.normalize_referral_code(raw text)
returns text
language sql
immutable
as $$
  select nullif(upper(trim(coalesce(raw, ''))), '');
$$;

create or replace function public.generate_referral_code()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result text;
  i int;
begin
  loop
    result := '';
    for i in 1..10 loop
      result := result || substr(
        alphabet,
        1 + (floor(random() * length(alphabet)))::int,
        1
      );
    end loop;
    exit when not exists (
      select 1 from public.profiles p where p.referral_code = result
    ) and not exists (
      select 1 from public.referral_seed_codes s where s.code = result
    );
  end loop;
  return result;
end;
$$;

revoke all on function public.generate_referral_code() from public;
revoke all on function public.generate_referral_code() from anon;
revoke all on function public.generate_referral_code() from authenticated;

-- Clients cannot rewrite referral bookkeeping (RPC sets obratka.referral_rpc).
create or replace function public.protect_profiles_referral()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('obratka.referral_rpc', true) = '1' then
    return new;
  end if;
  if (
    new.referral_code is distinct from old.referral_code
    or new.referred_by is distinct from old.referred_by
    or new.referral_uses is distinct from old.referral_uses
    or new.referral_entry_code is distinct from old.referral_entry_code
  )
     and coalesce(auth.jwt() ->> 'role', 'service_role') is distinct from 'service_role' then
    raise exception 'profiles.referral fields are read-only for clients';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_referral on public.profiles;
create trigger profiles_protect_referral
  before update on public.profiles
  for each row
  execute function public.protect_profiles_referral();

-- ---------------------------------------------------------------------------
-- Backfill codes for existing profiles
-- ---------------------------------------------------------------------------

update public.profiles
set referral_code = public.generate_referral_code()
where referral_code is null;

-- ---------------------------------------------------------------------------
-- handle_new_user: assign referral_code on insert
-- ---------------------------------------------------------------------------

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
  begin
    tg_id := nullif(meta->>'telegram_id', '')::bigint;
  exception when others then
    tg_id := null;
  end;

  new_code := public.generate_referral_code();

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

-- ---------------------------------------------------------------------------
-- RPC: validate (anon + authenticated) — does not consume a slot
-- ---------------------------------------------------------------------------

create or replace function public.validate_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
stable
as $$
declare
  normalized text := public.normalize_referral_code(p_code);
  profile_row public.profiles%rowtype;
  seed_row public.referral_seed_codes%rowtype;
  slots_left int;
begin
  if normalized is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into profile_row
  from public.profiles p
  where p.referral_code = normalized;

  if found then
    if profile_row.banned_at is not null then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    slots_left := greatest(0, 2 - coalesce(profile_row.referral_uses, 0));
    if slots_left <= 0 then
      return jsonb_build_object(
        'ok', false,
        'reason', 'exhausted',
        'code', normalized,
        'slots_left', 0
      );
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', normalized,
      'slots_left', slots_left,
      'kind', 'user'
    );
  end if;

  select * into seed_row
  from public.referral_seed_codes s
  where s.code = normalized;

  if found then
    slots_left := greatest(0, seed_row.max_uses - seed_row.uses);
    if slots_left <= 0 then
      return jsonb_build_object(
        'ok', false,
        'reason', 'exhausted',
        'code', normalized,
        'slots_left', 0
      );
    end if;
    return jsonb_build_object(
      'ok', true,
      'code', normalized,
      'slots_left', slots_left,
      'kind', 'seed'
    );
  end if;

  return jsonb_build_object('ok', false, 'reason', 'invalid');
end;
$$;

revoke all on function public.validate_referral(text) from public;
grant execute on function public.validate_referral(text) to anon;
grant execute on function public.validate_referral(text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: redeem (authenticated) — one-shot per user
-- ---------------------------------------------------------------------------

create or replace function public.redeem_referral(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  normalized text := public.normalize_referral_code(p_code);
  me public.profiles%rowtype;
  referrer public.profiles%rowtype;
  seed_row public.referral_seed_codes%rowtype;
begin
  if uid is null then
    return jsonb_build_object('ok', false, 'reason', 'not_authenticated');
  end if;

  if normalized is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  perform set_config('obratka.referral_rpc', '1', true);

  select * into me
  from public.profiles p
  where p.id = uid
  for update;

  if not found then
    return jsonb_build_object('ok', false, 'reason', 'no_profile');
  end if;

  -- Idempotent: already passed the gate.
  if me.referral_entry_code is not null then
    return jsonb_build_object(
      'ok', true,
      'reason', 'already_redeemed',
      'code', me.referral_entry_code
    );
  end if;

  if me.referral_code is not null and me.referral_code = normalized then
    return jsonb_build_object('ok', false, 'reason', 'self_referral');
  end if;

  select * into referrer
  from public.profiles p
  where p.referral_code = normalized
  for update;

  if found then
    if referrer.banned_at is not null then
      return jsonb_build_object('ok', false, 'reason', 'invalid');
    end if;
    if coalesce(referrer.referral_uses, 0) >= 2 then
      return jsonb_build_object('ok', false, 'reason', 'exhausted', 'slots_left', 0);
    end if;

    update public.profiles
    set
      referral_uses = referral_uses + 1,
      updated_at = now()
    where id = referrer.id;

    update public.profiles
    set
      referred_by = referrer.id,
      referral_entry_code = normalized,
      updated_at = now()
    where id = uid;

    return jsonb_build_object(
      'ok', true,
      'code', normalized,
      'kind', 'user',
      'slots_left', greatest(0, 1 - referrer.referral_uses)
    );
  end if;

  select * into seed_row
  from public.referral_seed_codes s
  where s.code = normalized
  for update;

  if found then
    if seed_row.uses >= seed_row.max_uses then
      return jsonb_build_object('ok', false, 'reason', 'exhausted', 'slots_left', 0);
    end if;

    update public.referral_seed_codes
    set uses = uses + 1
    where referral_seed_codes.code = seed_row.code;

    update public.profiles
    set
      referral_entry_code = normalized,
      updated_at = now()
    where id = uid;

    return jsonb_build_object(
      'ok', true,
      'code', normalized,
      'kind', 'seed',
      'slots_left', greatest(0, seed_row.max_uses - seed_row.uses - 1)
    );
  end if;

  return jsonb_build_object('ok', false, 'reason', 'invalid');
end;
$$;

revoke all on function public.redeem_referral(text) from public;
revoke all on function public.redeem_referral(text) from anon;
grant execute on function public.redeem_referral(text) to authenticated;
