-- Security audit fixes (apply after referrals/wallet/portfolios/portfolio_submit/review_claims SoT).
-- Idempotent create-or-replace / revoke.

-- Invite helpers (also in referrals.sql)
create or replace function public.invite_access_grandfather_before()
returns timestamptz
language sql
immutable
set search_path = public
as $$
  select timestamptz '2026-09-24 08:00:00+00';
$$;

create or replace function public.profile_has_invite_access(p_uid uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.profiles pr
    where pr.id = p_uid
      and (
        nullif(trim(coalesce(pr.referral_entry_code, '')), '') is not null
        or pr.created_at < public.invite_access_grandfather_before()
      )
  );
$$;

revoke all on function public.invite_access_grandfather_before() from public;
revoke all on function public.invite_access_grandfather_before() from anon;
revoke all on function public.invite_access_grandfather_before() from authenticated;
revoke all on function public.profile_has_invite_access(uuid) from public;
revoke all on function public.profile_has_invite_access(uuid) from anon;
revoke all on function public.profile_has_invite_access(uuid) from authenticated;

-- can_review_portfolio: force auth.uid()
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
      public.profile_grade((select auth.uid())),
      public.profile_grade(portfolio_owner_id)
    ),
    false
  );
$$;

revoke all on function public.spend_submit_cost() from public;
revoke all on function public.spend_submit_cost() from anon;
revoke all on function public.spend_submit_cost() from authenticated;

revoke all on table public.review_claims from anon;
revoke all on table public.review_claims from authenticated;
revoke all on table public.review_claims from public;

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

  if not public.profile_has_invite_access(uid) then
    raise exception 'invite_required';
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

create or replace function public.claim_portfolio_review(p_portfolio_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  p public.portfolios;
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

  if not public.profile_has_invite_access(uid) then
    raise exception 'invite_required';
  end if;

  perform public.purge_expired_review_claims();
  begin
    perform public.settle_review_reputation_rewards();
  exception when undefined_function then
    null;
  end;

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

  -- Дверь = набрали target completed. Live claims не считаем: пока карточка
  -- в ленте, можно зайти впятером; опоздавшие in-flight сдадут после done.
  if p.reviews_count >= p.target_reviews then
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


revoke all on function public.claim_portfolio_review(uuid) from public;
revoke all on function public.claim_portfolio_review(uuid) from anon;
grant execute on function public.claim_portfolio_review(uuid) to authenticated;

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
  grade text;
  role_slug text;
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

  -- Late overshoot: status уже done, но у ревьюера ещё живой claim — принимаем.
  if p.status not in ('pending', 'done') then
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

  select
    nullif(trim(pr.avatar_url), ''),
    nullif(trim(pr.display_name), ''),
    nullif(trim(pr.grade), ''),
    nullif(trim(pr.role), '')
  into avatar, display, grade, role_slug
  from public.profiles pr
  where pr.id = new.reviewer_id;

  -- Always overwrite denorm fields from the authenticated profile (ignore client).
  new.reviewer_avatar_url := avatar;
  new.reviewer_display_name := display;
  new.reviewer_grade := grade;
  new.reviewer_role := role_slug;

  -- Soft-cap free-text answers (client also caps; bypass via REST).
  if new.answers is not null and jsonb_typeof(new.answers) = 'object' then
    if new.answers ? 'advice'
       and jsonb_typeof(new.answers->'advice') = 'string'
       and char_length(new.answers->>'advice') > 1000 then
      new.answers := jsonb_set(
        new.answers,
        '{advice}',
        to_jsonb(left(new.answers->>'advice', 1000))
      );
    end if;
    if new.answers ? 'dictation'
       and jsonb_typeof(new.answers->'dictation') = 'string'
       and char_length(new.answers->>'dictation') > 4000 then
      new.answers := jsonb_set(
        new.answers,
        '{dictation}',
        to_jsonb(left(new.answers->>'dictation', 4000))
      );
    end if;
  end if;

  update public.portfolios
  set
    reviews_count = p.reviews_count + 1,
    status = case
      when p.reviews_count + 1 >= p.target_reviews then 'done'
      else p.status
    end,
    completed_at = case
      when p.reviews_count + 1 >= p.target_reviews
        then coalesce(p.completed_at, now())
      else p.completed_at
    end
  where id = new.portfolio_id;

  delete from public.review_claims
  where portfolio_id = new.portfolio_id
    and reviewer_id = new.reviewer_id;

  -- Award REVIEW_REWARD (10) server-side; clients cannot write balance.
  perform set_config('app.bypass_profile_guards', 'on', true);
  update public.profiles
  set balance = balance + 10
  where id = new.reviewer_id;

  return new;
end;
$$;


revoke all on function public.handle_review_inserted() from public;
revoke all on function public.handle_review_inserted() from anon;
revoke all on function public.handle_review_inserted() from authenticated;

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


revoke all on function public.handle_new_user() from public;
revoke all on function public.handle_new_user() from anon;
revoke all on function public.handle_new_user() from authenticated;
