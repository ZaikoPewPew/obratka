-- Legendary online presence (heartbeat last_seen_at).
-- Apply after profiles.sql. Mutations only via security definer RPC.

alter table public.profiles
  add column if not exists last_seen_at timestamptz;

create index if not exists profiles_legendary_last_seen_idx
  on public.profiles (last_seen_at desc)
  where tier = 'legendary' and banned_at is null;

-- Clients cannot spoof presence; heartbeat RPC uses bypass GUC.
create or replace function public.protect_profiles_last_seen()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_setting('app.bypass_profile_guards', true) = 'on' then
    return new;
  end if;
  if new.last_seen_at is distinct from old.last_seen_at
     and coalesce(auth.jwt() ->> 'role', 'service_role') is distinct from 'service_role' then
    raise exception 'profiles.last_seen_at is read-only for clients';
  end if;
  return new;
end;
$$;

drop trigger if exists profiles_protect_last_seen on public.profiles;
create trigger profiles_protect_last_seen
  before update on public.profiles
  for each row
  execute function public.protect_profiles_last_seen();

revoke all on function public.protect_profiles_last_seen() from public;
revoke all on function public.protect_profiles_last_seen() from anon;
revoke all on function public.protect_profiles_last_seen() from authenticated;

-- Online window for list_online_legendaries (heartbeat ~60–90s).
create or replace function public.legendary_presence_ttl()
returns interval
language sql
immutable
set search_path = public
as $$
  select interval '2 minutes';
$$;

revoke all on function public.legendary_presence_ttl() from public;
revoke all on function public.legendary_presence_ttl() from anon;
revoke all on function public.legendary_presence_ttl() from authenticated;

-- Ping: only legendary (and not banned). No-op otherwise.
create or replace function public.heartbeat_legendary_presence()
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

  perform set_config('app.bypass_profile_guards', 'on', true);

  update public.profiles
  set last_seen_at = now()
  where id = uid
    and tier = 'legendary'
    and banned_at is null;
end;
$$;

revoke all on function public.heartbeat_legendary_presence() from public;
revoke all on function public.heartbeat_legendary_presence() from anon;
grant execute on function public.heartbeat_legendary_presence() to authenticated;

-- Who is online now (VIP only). VOLATILE: PostgREST + security definer.
drop function if exists public.list_online_legendaries();

create or replace function public.list_online_legendaries()
returns table (
  id uuid,
  display_name text,
  avatar_url text
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ttl interval := public.legendary_presence_ttl();
begin
  if uid is null then
    return;
  end if;

  return query
  select
    p.id,
    p.display_name,
    p.avatar_url
  from public.profiles p
  where p.tier = 'legendary'
    and p.banned_at is null
    and p.last_seen_at is not null
    and p.last_seen_at > now() - ttl
  order by p.last_seen_at desc;
end;
$$;

revoke all on function public.list_online_legendaries() from public;
revoke all on function public.list_online_legendaries() from anon;
grant execute on function public.list_online_legendaries() to authenticated;
