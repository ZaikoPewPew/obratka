# `supabase/` — SQL и инфраструктура БД

Папка для SQL-скриптов и Edge Functions, связанных с проектом Supabase.

## Состав

- `sql/profiles.sql` — таблица `public.profiles` (1:1 с `auth.users`), триггер создания профиля, RLS, `tier` (`free` / `pro` / `legendary`).
- `sql/subscribers_count.sql` — функция `public.subscribers_count()` и `grant execute` для безопасного получения количества подписчиков при RLS.
- `functions/telegram-auth/` — вход через Telegram Login Widget → сессия Supabase Auth (см. README в папке функции).

## Auth-провайдеры

| Провайдер | Где настраивать |
|-----------|-----------------|
| Telegram | `TELEGRAM_BOT_*` + Edge Function secrets |
| Google | Supabase Dashboard → Authentication → Providers → Google (Client ID/Secret из Google Cloud) |

Redirect URLs приложения (Site URL / Additional Redirect URLs): локальный origin Vite и Pages (`/obratka/`). Подробнее — `src/components/auth-screen/README.md`.
