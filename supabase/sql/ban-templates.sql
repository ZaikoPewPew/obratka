-- =============================================================================
-- Шаблоны бана / разбана (public.profiles)
-- Полная инструкция: ../BAN.md
-- Вставь в Supabase → SQL Editor → подставь значения → Run
-- =============================================================================

-- --- Найти пользователя ------------------------------------------------------
select id, email, display_name, telegram_username, telegram_id, banned_at, ban_reason
from public.profiles
where email ilike '%@%'
   or display_name ilike '%Имя%'
   or telegram_username ilike '%nick%'
order by created_at desc;

-- --- Список забаненных -------------------------------------------------------
select id, email, display_name, telegram_username, banned_at, ban_reason
from public.profiles
where banned_at is not null
order by banned_at desc;

-- --- Забанить по id ----------------------------------------------------------
update public.profiles
set
  banned_at = now(),
  ban_reason = 'toxicity'  -- toxicity | bad_reviews | spam | other
where id = '00000000-0000-0000-0000-000000000000';

-- --- Забанить по email -------------------------------------------------------
update public.profiles
set
  banned_at = now(),
  ban_reason = 'toxicity'
where email = 'user@example.com';

-- --- Забанить по telegram_username (без @) -----------------------------------
update public.profiles
set
  banned_at = now(),
  ban_reason = 'toxicity'
where telegram_username = 'username';

-- --- Забанить по telegram_id -------------------------------------------------
update public.profiles
set
  banned_at = now(),
  ban_reason = 'toxicity'
where telegram_id = 123456789;

-- --- Разбанить ---------------------------------------------------------------
update public.profiles
set
  banned_at = null,
  ban_reason = null
where id = '00000000-0000-0000-0000-000000000000';
-- where email = 'user@example.com';
-- where telegram_username = 'username';
