# `supabase/sql/` — SQL-скрипты

## Состав

| Файл | Роль |
|------|------|
| `profiles.sql` | таблица `public.profiles` (1:1 с `auth.users`), триггер `handle_new_user` (в т.ч. Google `app_metadata.provider`), RLS, колонки онбординга / balance / avatar |
| `subscribers_count.sql` | RPC `public.subscribers_count()` + `grant execute` для `anon` / `authenticated` |

Применять в SQL Editor Dashboard или через CLI. Обзор — [`../README.md`](../README.md).
