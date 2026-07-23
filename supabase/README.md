# `supabase/` — SQL и инфраструктура БД

Папка для SQL-скриптов и Edge Functions проекта Supabase.

Клиентский Auth API: [`src/api/README.md`](../src/api/README.md).  
UI / Dashboard setup: [`src/components/auth-screen/README.md`](../src/components/auth-screen/README.md).

## Состав

| Путь | Роль |
|------|------|
| `sql/profiles.sql` | `public.profiles` (1:1 с `auth.users`), триггер `handle_new_user`, RLS, `tier`, `banned_at` / `ban_reason` |
| `sql/portfolios.sql` | `public.portfolios` + `public.reviews`, очередь ревью, RLS (banned не может INSERT) |
| `sql/subscribers_count.sql` | RPC `subscribers_count()` (legacy waitlist) |
| `functions/telegram-auth/` | Telegram Login Widget → сессия Supabase Auth |

Подробнее по SQL: [`sql/README.md`](sql/README.md).  
Telegram Edge: [`functions/telegram-auth/README.md`](functions/telegram-auth/README.md).

## Auth-провайдеры

| Провайдер | Где настраивать |
|-----------|-----------------|
| **Email OTP** | Dashboard → Authentication → Providers → Email; шаблон **Magic Link** должен содержать `{{ .Token }}` (иначе уходит ссылка, не код) |
| **Telegram** | `TELEGRAM_BOT_ID` в клиенте + `TELEGRAM_BOT_TOKEN` в Edge secrets |
| **Google** | Dashboard → Providers → Google (Client ID/Secret из Google Cloud) |

Redirect URLs (Site URL / Additional Redirect URLs):

- `http://localhost:5173/`
- `https://zaikopewpew.github.io/obratka/`

Google Authorized redirect URI в Cloud Console: `https://<project-ref>.supabase.co/auth/v1/callback`.

**Identity linking:** Automatic linking (одна verified email = один user для Email ↔ Google) работает из коробки. Manual linking / `linkIdentity` не включать без UI. Подробнее — [`auth-screen/README.md`](../src/components/auth-screen/README.md).

**Клиентский anti-abuse OTP:** cooldown resend на `auth-code-screen` (`--auth-code-resend-cooldown`); маппинг ошибок — `mapSupabaseAuthErrorCode` в [`src/api/README.md`](../src/api/README.md).

## Связь с приложением

| Таблица / сервис | Кто читает/пишет |
|-----------------|------------------|
| `auth.users` | Supabase Auth (все провайдеры) |
| `profiles` | `profiles.js`, `onboarding.js`, `wallet.js`; автосоздание триггером; `banned_at` → ban-screen |
| `portfolios` / `reviews` | `portfolios.js` (INSERT blocked if banned) |
| `subscribers` | `subscribers.js` (не entry UX) |

## Бан пользователя (оператор)

SQL Editor / Table Editor (service_role), не из клиента:

```sql
update public.profiles
set banned_at = now(), ban_reason = 'toxicity'
where id = '<user-uuid>';
```

Снять: `banned_at = null`, `ban_reason = null`. UI: `/banned` (`ban-screen`).
