# `supabase/sql/` — SQL-скрипты

## Состав

| Файл | Роль |
|------|------|
| `profiles.sql` | таблица `public.profiles` (1:1 с `auth.users`), триггер `handle_new_user` (в т.ч. Google `app_metadata.provider`), RLS, колонки онбординга / balance / avatar / `tier` (`free`\|`pro`\|`legendary`, клиент read-only), `banned_at` / `ban_reason` (клиент read-only) + `is_profile_banned()` |
| `portfolios.sql` | `public.portfolios` + `public.reviews`, лиги матчинга (`grade_league` / `can_review_portfolio`), RLS (лента только в лиге; INSERT review с проверкой лиги), триггер инкремента / `done` |
| `review_claims.sql` | `public.review_claims` + RPC claim/heartbeat/release/slots; `reviews.answers`; BEFORE-триггер требует живой claim |
| `ban-templates.sql` | операторские шаблоны: бан / разбан / поиск (см. [`../BAN.md`](../BAN.md)) |
| `delete-account-templates.sql` | полное удаление тестового аккаунта: `DELETE` из `auth.users` → cascade `profiles` / `portfolios` / `reviews` |
| `subscribers_count.sql` | RPC `public.subscribers_count()` + `grant execute` для `anon` / `authenticated` |

Применять в SQL Editor Dashboard или через CLI. Обзор — [`../README.md`](../README.md).  
**Как банить юзеров:** [`../BAN.md`](../BAN.md).
