-- Wallet / balance security
-- Apply after profiles.sql. Idempotent.
--
-- Clients cannot UPDATE profiles.balance directly.
-- spend_submit_cost() — списание за подачу портфолио.
-- Награда за ревью — в handle_review_inserted (review_claims.sql) через bypass GUC.

-- ---------------------------------------------------------------------------
-- Protect balance (also mirrored in profiles.sql for fresh installs)
-- ---------------------------------------------------------------------------

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

revoke all on function public.protect_profiles_balance() from public;
revoke all on function public.protect_profiles_balance() from anon;
revoke all on function public.protect_profiles_balance() from authenticated;

-- ---------------------------------------------------------------------------
-- Spend submit cost (1 coin). Returns new balance.
-- ---------------------------------------------------------------------------

create or replace function public.spend_submit_cost()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bal integer;
  cost constant integer := 1;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if public.is_profile_banned(uid) then
    raise exception 'banned';
  end if;

  perform set_config('app.bypass_profile_guards', 'on', true);

  update public.profiles
  set balance = balance - cost
  where id = uid
    and balance >= cost
  returning balance into bal;

  if not found or bal is null then
    raise exception 'insufficient_balance';
  end if;

  return bal;
end;
$$;

revoke all on function public.spend_submit_cost() from public;
revoke all on function public.spend_submit_cost() from anon;
grant execute on function public.spend_submit_cost() to authenticated;
