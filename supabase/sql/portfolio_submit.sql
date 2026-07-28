-- Atomic portfolio submit: spend 30 coins + INSERT + max 1 pending per owner.
-- Apply after portfolios.sql (+ wallet.sql for balance guards). Idempotent.
--
-- Clients must not INSERT portfolios directly — only this RPC.

create index if not exists portfolios_owner_status_idx
  on public.portfolios (owner_id, status);

-- ---------------------------------------------------------------------------
-- Max concurrent pending portfolios per owner
-- ---------------------------------------------------------------------------

create or replace function public.max_mine_pending()
returns integer
language sql
immutable
set search_path = public
as $$
  select 1;
$$;

revoke all on function public.max_mine_pending() from public;
revoke all on function public.max_mine_pending() from anon;
revoke all on function public.max_mine_pending() from authenticated;

-- ---------------------------------------------------------------------------
-- submit_portfolio — spend + insert in one transaction
-- ---------------------------------------------------------------------------

create or replace function public.submit_portfolio(
  p_url text,
  p_name text default null,
  p_role text default null,
  p_avatar_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  bal integer;
  cost constant integer := 30;
  max_pending constant integer := public.max_mine_pending();
  pending_count integer;
  clean_url text := trim(coalesce(p_url, ''));
  row_portfolios public.portfolios;
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;

  if public.is_profile_banned(uid) then
    raise exception 'banned';
  end if;

  if clean_url = '' then
    raise exception 'url_required';
  end if;

  -- Mirror client normalizePortfolioUrl: only http(s); host must contain '.'.
  if clean_url ~* '^[a-z][a-z0-9+.-]*:' and clean_url !~* '^https?://' then
    raise exception 'invalid_url';
  end if;

  if clean_url !~* '^https?://' then
    clean_url := 'https://' || clean_url;
  end if;

  if nullif(
       substring(clean_url from '^https?://(?:[^/?#]*@)?([^/?#:]+)'),
       ''
     ) is null
     or substring(clean_url from '^https?://(?:[^/?#]*@)?([^/?#:]+)') !~ '\.'
  then
    raise exception 'invalid_url';
  end if;

  select count(*)::integer into pending_count
  from public.portfolios
  where owner_id = uid
    and status = 'pending';
  if pending_count >= max_pending then
    raise exception 'too_many_pending';
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

  insert into public.portfolios (
    owner_id,
    url,
    name,
    role,
    avatar_url,
    target_reviews,
    reviews_count,
    status
  )
  values (
    uid,
    clean_url,
    nullif(trim(coalesce(p_name, '')), ''),
    nullif(trim(coalesce(p_role, '')), ''),
    nullif(trim(coalesce(p_avatar_url, '')), ''),
    3,
    0,
    'pending'
  )
  returning * into row_portfolios;

  return jsonb_build_object(
    'id', row_portfolios.id,
    'owner_id', row_portfolios.owner_id,
    'url', row_portfolios.url,
    'name', row_portfolios.name,
    'role', row_portfolios.role,
    'avatar_url', row_portfolios.avatar_url,
    'target_reviews', row_portfolios.target_reviews,
    'reviews_count', row_portfolios.reviews_count,
    'status', row_portfolios.status,
    'created_at', row_portfolios.created_at,
    'balance', bal
  );
end;
$$;

revoke all on function public.submit_portfolio(text, text, text, text) from public;
revoke all on function public.submit_portfolio(text, text, text, text) from anon;
grant execute on function public.submit_portfolio(text, text, text, text) to authenticated;

-- Direct INSERT closed: only security definer RPC above.
drop policy if exists "portfolios_insert_own" on public.portfolios;
revoke insert on table public.portfolios from authenticated;
grant select on table public.portfolios to authenticated;
