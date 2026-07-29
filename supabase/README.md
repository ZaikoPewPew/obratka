# `supabase/` — SQL и инфраструктура БД

Папка для SQL-скриптов и Edge Functions проекта Supabase.

Клиентский Auth API: [`src/api/README.md`](../src/api/README.md).  
UI / Dashboard setup: [`src/components/auth-screen/README.md`](../src/components/auth-screen/README.md).

## Состав

| Путь | Роль |
|------|------|
| `BAN.md` | **Оператор:** как банить (Table Editor + SQL), шаблоны |
| `SECURITY.md` | Матрица доступа к RPC, состояние адвайзоров, отложенное до Pro |
| `sql/profiles.sql` | `public.profiles`, protect tier/ban/reputation/balance/grade, referral |
| `sql/legendary_presence.sql` | `last_seen_at` + heartbeat/list для legendary online |
| `sql/rating_leaderboard.sql` | снапшот топ-50 по `balance` + RPC `list_rating_top` |
| `sql/wallet.sql` | protect balance + RPC `spend_submit_cost` (legacy, cost 30) |
| `sql/referrals.sql` | referral-код на профиль (лимит 2), seed `YTHWKPDWAK`, RPC validate/redeem |
| `sql/portfolios.sql` | portfolios/reviews, лиги; INSERT pending/0/target=3 |
| `sql/portfolio_submit.sql` | RPC `submit_portfolio` (atomic spend 30 + insert, max 1 pending); revoke client INSERT |
| `sql/review_claims.sql` | claims + award (+10); `portfolio_reviewer_slots` + purge expired; apply — [`sql/README.md`](sql/README.md) § «Как применять» |
| `sql/review_complaints.sql` | жалобы на листы → reputation (старт 0 / бан −100 / +10 settle от done) → автобан |
| `sql/subscribers_rls.sql` | RLS на legacy `subscribers` (если таблица есть) |
| `sql/ban-templates.sql` | Copy-paste SQL: бан / разбан / поиск |
| `sql/delete-account-templates.sql` | полное удаление тестового аккаунта |
| `sql/portfolio-role-backfill.sql` | одноразовый backfill `portfolios.role` |
| `sql/subscribers_count.sql` | RPC `subscribers_count()` (legacy waitlist) |
| `sql/portfolio_preview_cache.sql` | Storage-бакет `portfolio-previews` для кэша превью-скриншотов (Edge `portfolio-preview`) |
| `functions/telegram-auth/` | Telegram Login Widget → сессия Supabase Auth |
| `functions/portfolio-preview/` | Прокси/кэш перед thum.io для превью карточек (429-hardening) |
| `functions/portfolio-embed-probe/` | XFO/CSP frame-ancestors (+ Readymag HTML) → iframe vs external |

Подробнее по SQL: [`sql/README.md`](sql/README.md).  
**Бан юзеров:** [`BAN.md`](BAN.md) ← начинать отсюда.  
**Доступы / адвайзоры:** [`SECURITY.md`](SECURITY.md).  
Telegram Edge: [`functions/telegram-auth/README.md`](functions/telegram-auth/README.md).  
Превью Edge: [`functions/portfolio-preview/README.md`](functions/portfolio-preview/README.md).

## Auth-провайдеры

| Провайдер | Где настраивать |
|-----------|-----------------|
| **Email OTP** | Dashboard → Authentication → Providers → Email; шаблон **Magic Link** должен содержать `{{ .Token }}` (иначе уходит ссылка, не код). При наплыве регистраций — обязателен custom SMTP, см. [`SECURITY.md`](SECURITY.md) § «Наплыв регистраций» |
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
| `profiles` | `profiles.js`, `onboarding.js`, `wallet.js`, `referrals.js`, `reviewComplaints.js`; автосоздание триггером; `banned_at` → ban-screen; `reputation` (default 0, floor −100) → чип на home (`formatReputation`); `referral_code` (лимит 2) |
| `referral_seed_codes` | только через RPC (bootstrap `YTHWKPDWAK`) |
| `portfolios` / `reviews` | `portfolios.js` (очередь по лигам; INSERT blocked if banned / league mismatch) |
| `review_complaints` | `reviewComplaints.js` (insert только RPC; select своих жалоб автором) |
| `subscribers` | `subscribers.js` (не entry UX) |
| Storage `portfolio-previews` | `portfolios.js` (`portfolioPreviewUrl` → Edge `portfolio-preview`); публичный read, пишет только Edge Function |

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
