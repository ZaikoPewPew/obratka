-- =============================================================================
-- Шаблоны полного удаления тестового аккаунта
-- Вставь в Supabase → SQL Editor → подставь значения → Run
--
-- Достаточно DELETE из auth.users: каскадом уйдут
--   public.profiles
--   public.portfolios (owner_id)
--   public.reviews (reviewer_id; ревью чужих портфолио этим юзером)
--   ревью на портфолио юзера (через portfolios on delete cascade)
--
-- Удаление только из profiles — НЕ чистит Auth (останется «зомби»-логин).
-- Необратимо. Не гонять без WHERE / на проде без проверки.
-- =============================================================================

-- --- Найти пользователя (проверь id перед удалением) -------------------------
select
  p.id,
  p.email,
  p.display_name,
  p.telegram_username,
  p.telegram_id,
  p.onboarding_done,
  p.balance,
  p.banned_at,
  u.created_at as auth_created_at,
  u.last_sign_in_at
from public.profiles p
left join auth.users u on u.id = p.id
where p.email ilike '%@%'
   or p.display_name ilike '%Имя%'
   or p.telegram_username ilike '%nick%'
order by p.created_at desc;

-- Что ещё висит на этом id (подставь uuid) ------------------------------------
-- select id, url, status, created_at
-- from public.portfolios
-- where owner_id = '00000000-0000-0000-0000-000000000000';
--
-- select id, portfolio_id, created_at
-- from public.reviews
-- where reviewer_id = '00000000-0000-0000-0000-000000000000';

-- --- Удалить целиком по id ---------------------------------------------------
-- delete from auth.users
-- where id = '00000000-0000-0000-0000-000000000000';

-- --- Удалить целиком по email ------------------------------------------------
-- delete from auth.users
-- where email = 'user@example.com';

-- --- Удалить целиком по telegram_id (через profiles) -------------------------
-- delete from auth.users
-- where id in (
--   select id from public.profiles where telegram_id = 123456789
-- );

-- --- Удалить целиком по telegram_username (без @) ----------------------------
-- delete from auth.users
-- where id in (
--   select id from public.profiles where telegram_username = 'username'
-- );

-- --- Проверка: строк больше нет ----------------------------------------------
-- select id, email from auth.users
-- where id = '00000000-0000-0000-0000-000000000000'
--    or email = 'user@example.com';
--
-- select id, email from public.profiles
-- where id = '00000000-0000-0000-0000-000000000000'
--    or email = 'user@example.com';
