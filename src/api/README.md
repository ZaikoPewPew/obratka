# `src/api/` — сетевой слой

Модули для Supabase Auth, профилей, рефералов и продуктового API.

## Auth и профиль

| Файл | Роль |
|------|------|
| `auth.js` | Email OTP (`requestEmailOtp` / `verifyEmailOtp`); Telegram Login → Edge Function; Google OAuth (`signInWithGoogle` / `completeOAuthFromUrl`); `mapSupabaseAuthErrorCode`; `signOut` |
| `telegramWidget.js` | загрузка Login Widget / `Telegram.Login.auth` |
| `profiles.js` | `fetchMyProfile` / `updateMyProfile` / `isProfileBanned` (`public.profiles`; `tier`, `banned_*`, `reputation` только чтение) |
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
| `wallet.js` | `getBalance` / `spendSubmitCost` (RPC) / `awardReviewReward` (= refresh) / `creditBalance` (temp RPC `temp_credit_balance` / DEV local) / `REVIEW_REWARD` / `SUBMIT_COST`; `refreshSessionFromProfile` |
| `leagues.js` | матчинг лиг по `grade` (зеркало SQL): `gradeToLeague` / `canReviewGrades` |
| `portfolios.js` | `listPortfoliosForReview` (чужие pending в лиге + слоты; до 3/3 completed) / `listMyPortfolios` / claim·heartbeat·release / `submitPortfolio` / `submitPortfolioReview` (+ answers) + `formatPortfolioRole` |
| `reviewComplaints.js` | жалобы на листы: `listPortfolioReviewSheets` / `submitReviewComplaint` / `getReputation` / `formatReputationDelta`; теги v1 без весов на клиенте; RPC `submit_review_complaint` |
| `referrals.js` | `validateReferral` / `redeemReferral` / `fetchMyReferral`; реэкспорт `normalizeReferralCode` / `buildReferralShareUrl` / `REFERRAL_MAX_USES` из `utils/referralCode.js` (RPC + seed `YTHWKPDWAK`; **без наград**) |

См. [`SCREENS.md`](../../SCREENS.md), [`supabase/sql/referrals.sql`](../../supabase/sql/referrals.sql).
