-- Rating leaderboard: топ-50 профилей по balance, снапшот раз в сутки.
-- Apply after profiles.sql. Читать только через RPC list_rating_top.

create table if not exists public.rating_leaderboard (
  place smallint primary key,
  profile_id uuid not null references public.profiles (id) on delete cascade,
  display_name text,
  avatar_url text,
  grade text,
  role text,
  balance integer not null default 0,
  refreshed_at timestamptz not null default now()
);

-- Доступ только через security definer RPC — политик нет намеренно.
alter table public.rating_leaderboard enable row level security;

revoke all on table public.rating_leaderboard from public;
revoke all on table public.rating_leaderboard from anon;
revoke all on table public.rating_leaderboard from authenticated;

-- Как часто пересобирается снапшот (обновление рейтинга раз в сутки).
create or replace function public.rating_leaderboard_ttl()
returns interval
language sql
immutable
set search_path = public
as $$
  select interval '24 hours';
$$;

revoke all on function public.rating_leaderboard_ttl() from public;
revoke all on function public.rating_leaderboard_ttl() from anon;
revoke all on function public.rating_leaderboard_ttl() from authenticated;

-- Пересборка снапшота: топ-50 по balance, без banned, только после онбординга.
-- SECURITY DEFINER: читает чужие profiles.balance, которые закрыты RLS.
create or replace function public.refresh_rating_leaderboard()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rating_leaderboard;

  insert into public.rating_leaderboard
    (place, profile_id, display_name, avatar_url, grade, role, balance, refreshed_at)
  select
    (row_number() over (order by p.balance desc, p.created_at asc, p.id asc))::smallint,
    p.id,
    p.display_name,
    p.avatar_url,
    p.grade,
    p.role,
    p.balance,
    now()
  from public.profiles p
  where p.banned_at is null
    and p.onboarding_done
  order by p.balance desc, p.created_at asc, p.id asc
  limit 50;
end;
$$;

revoke all on function public.refresh_rating_leaderboard() from public;
revoke all on function public.refresh_rating_leaderboard() from anon;
revoke all on function public.refresh_rating_leaderboard() from authenticated;

-- Топ-50 для вкладки «Рейтинг». Ленивое обновление: если снапшот старше TTL,
-- первый запрос пересобирает его (advisory lock против параллельных пересборок;
-- не взяли lock — отдаём прежний снапшот). VOLATILE: PostgREST + security definer.
drop function if exists public.list_rating_top();

create or replace function public.list_rating_top()
returns table (
  place smallint,
  profile_id uuid,
  display_name text,
  avatar_url text,
  grade text,
  role text,
  balance integer
)
language plpgsql
volatile
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  ttl interval := public.rating_leaderboard_ttl();
  last_refresh timestamptz;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  select max(l.refreshed_at) into last_refresh from public.rating_leaderboard l;

  if (last_refresh is null or last_refresh <= now() - ttl)
     and pg_try_advisory_xact_lock(hashtext('rating_leaderboard_refresh')) then
    perform public.refresh_rating_leaderboard();
  end if;

  return query
  select
    l.place,
    l.profile_id,
    l.display_name,
    l.avatar_url,
    l.grade,
    l.role,
    l.balance
  from public.rating_leaderboard l
  order by l.place asc;
end;
$$;

revoke all on function public.list_rating_top() from public;
revoke all on function public.list_rating_top() from anon;
grant execute on function public.list_rating_top() to authenticated;
