# `src/api/` — сетевой слой

Модули для Supabase Auth, профилей и продуктовых stubs.

## Auth и профиль

| Файл | Роль |
|------|------|
| `auth.js` | Email OTP (`requestEmailOtp` / `verifyEmailOtp`); Telegram Login → Edge Function; Google OAuth (`signInWithGoogle` / `completeOAuthFromUrl`); `mapSupabaseAuthErrorCode`; `signOut` |
| `telegramWidget.js` | загрузка Login Widget / `Telegram.Login.auth` |
| `profiles.js` | `fetchMyProfile` / `updateMyProfile` / `isProfileBanned` (`public.profiles`; `tier` и `banned_*` только чтение) |
| `onboarding.js` | `saveOnboardingAnswers` → колонки + `onboarding` jsonb в профиле |
| `subscribers.js` | waitlist: POST email + RPC/HEAD count |

### Провайдеры

| Провайдер | Как |
|-----------|-----|
| Telegram | Widget → `telegram-auth` Edge Function → `verifyOtp` / сессия |
| Google | `signInWithOAuth` (PKCE) → redirect → `completeOAuthFromUrl` при старте |
| Email | `signInWithOtp` → код на почту → `verifyOtp` (`type: "email"`) |

### Стабильные коды ошибок (`mapSupabaseAuthErrorCode`)

Клиент мапит ответы GoTrue / OAuth в короткие коды для i18n:

| Код | Когда | UI-ключ |
|-----|--------|---------|
| `email_otp_rate_limit` | 429 / rate limit | `authOtpRateLimit` |
| `auth_identity_conflict` | identity already linked / email_exists / user already registered | `authIdentityConflict` |
| `email_otp_invalid` | неверный / просроченный OTP | `authOtpInvalid` |

OAuth callback с ошибкой: `main.js` кладёт код в `sessionStorage` (`obratka.authProviderError`) → `auth-screen` показывает при `open`.

### Identity linking

- **Automatic linking** (Supabase, по умолчанию): Email ↔ Google с одной **verified** email → один `auth.users`. В приложении отдельного `linkIdentity` нет.
- **Telegram:** synthetic `tg{id}@t.me` — не участвует в automatic linking с реальным email.
- **Manual linking** / UNIQUE `profiles.email` — roadmap (`PROJECT.md` #4).

Env / Dashboard: `.env.example`, `src/components/auth-screen/README.md`, `supabase/README.md`.

**Dashboard (обязательно для email):** Authentication → Providers → Email → OTP включён; шаблон Magic Link содержит `{{ .Token }}`. Без этого код на `/registration/code` не придёт.

## Кошелёк и портфолио

| Файл | Роль |
|------|------|
| `wallet.js` | `getBalance` / `creditBalance` / `spendForSubmit` / `REVIEW_REWARD` / `SUBMIT_COST`; `refreshSessionFromProfile` + `refreshWalletFromServer` (`profiles.balance` ↔ session) |
| `leagues.js` | матчинг лиг по `grade` (зеркало SQL): `gradeToLeague` / `canReviewGrades` |
| `portfolios.js` | `listPortfoliosForReview` (чужие в лиге, RLS, без полных слотов) / `listMyPortfolios` / claim·heartbeat·release / `submitPortfolio` / `submitPortfolioReview` (+ answers) + `formatPortfolioRole` |
| `referrals.js` | validate / redeem (stub) |

См. [`SCREENS.md`](../../SCREENS.md).
