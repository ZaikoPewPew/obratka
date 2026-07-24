# `supabase/` — SQL и инфраструктура БД

Папка для SQL-скриптов и Edge Functions проекта Supabase.

Клиентский Auth API: [`src/api/README.md`](../src/api/README.md).  
UI / Dashboard setup: [`src/components/auth-screen/README.md`](../src/components/auth-screen/README.md).

## Состав

| Путь | Роль |
|------|------|
| `BAN.md` | **Оператор:** как банить (Table Editor + SQL), шаблоны |
| `sql/profiles.sql` | `public.profiles` (1:1 с `auth.users`), триггер `handle_new_user`, RLS, `tier`, `banned_at` / `ban_reason`, `reputation`, колонки referral |
| `sql/referrals.sql` | referral-код на профиль (лимит 2), seed `YTHWKPDWAK`, RPC `validate_referral` / `redeem_referral` |
| `sql/portfolios.sql` | `public.portfolios` + `public.reviews`, очередь ревью, RLS (banned не может INSERT) |
| `sql/review_complaints.sql` | жалобы на листы → `reputation` → автобан (`submit_review_complaint`) |
| `sql/ban-templates.sql` | Copy-paste SQL: бан / разбан / поиск |
| `sql/subscribers_count.sql` | RPC `subscribers_count()` (legacy waitlist) |
| `functions/telegram-auth/` | Telegram Login Widget → сессия Supabase Auth |

Подробнее по SQL: [`sql/README.md`](sql/README.md).  
**Бан юзеров:** [`BAN.md`](BAN.md) ← начинать отсюда.  
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
| `profiles` | `profiles.js`, `onboarding.js`, `wallet.js`, `referrals.js`, `reviewComplaints.js`; автосоздание триггером; `banned_at` → ban-screen; `reputation` → чип на home; `referral_code` (лимит 2) |
| `referral_seed_codes` | только через RPC (bootstrap `YTHWKPDWAK`) |
| `portfolios` / `reviews` | `portfolios.js` (очередь по лигам; INSERT blocked if banned / league mismatch) |
| `review_complaints` | `reviewComplaints.js` (insert только RPC; select своих жалоб автором) |
| `subscribers` | `subscribers.js` (не entry UX) |

## Бан пользователя (оператор)

Полная шпаргалка + шаблоны: **[`BAN.md`](BAN.md)**  
Copy-paste SQL: [`sql/ban-templates.sql`](sql/ban-templates.sql)

Кратко: Dashboard → **SQL Editor** (2-я иконка слева) или Table Editor → `profiles` → заполни `banned_at`.

```sql
update public.profiles
set banned_at = now(), ban_reason = 'toxicity'
where email = 'user@example.com';
```

Снять: `banned_at = null`, `ban_reason = null`. UI: `/banned` (`ban-screen`).

Клиентский JWT не может менять ban/tier; **SQL Editor** и Table Editor — могут.
