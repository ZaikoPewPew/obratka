# `supabase/` — SQL и инфраструктура БД

Папка для SQL-скриптов и Edge Functions, связанных с проектом Supabase.

## Состав

- `sql/profiles.sql` — таблица `public.profiles` (1:1 с `auth.users`), триггер создания профиля, RLS.
- `sql/subscribers_count.sql` — функция `public.subscribers_count()` и `grant execute` для безопасного получения количества подписчиков при RLS.
- `functions/telegram-auth/` — вход через Telegram Login Widget → сессия Supabase Auth (см. README в папке функции).
