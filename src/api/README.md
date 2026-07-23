# `src/api/` — сетевой слой

Модули для Supabase Auth, профилей и продуктовых stubs.

## Auth и профиль

| Файл | Роль |
|------|------|
| `auth.js` | Telegram Login → Edge Function; Google OAuth (`signInWithGoogle` / `completeOAuthFromUrl`); `signOut` |
| `telegramWidget.js` | загрузка Login Widget / `Telegram.Login.auth` |
| `profiles.js` | `fetchMyProfile` / `updateMyProfile` (`public.profiles`; `tier` только чтение) |
| `onboarding.js` | `saveOnboardingAnswers` → колонки + `onboarding` jsonb в профиле |
| `subscribers.js` | waitlist: POST email + RPC/HEAD count |

### Провайдеры

| Провайдер | Как |
|-----------|-----|
| Telegram | Widget → `telegram-auth` Edge Function → `setSession` |
| Google | `signInWithOAuth` (PKCE) → redirect → `completeOAuthFromUrl` при старте |
| Email | UI есть; Supabase email auth пока не wired |

Env / Dashboard: `.env.example`, `src/components/auth-screen/README.md`, `supabase/README.md`.

## Кошелёк и портфолио

| Файл | Роль |
|------|------|
| `wallet.js` | `getBalance` / `creditBalance` / `spendForSubmit` / `REVIEW_REWARD` / `SUBMIT_COST`; `refreshSessionFromProfile` + `refreshWalletFromServer` (`profiles.balance` ↔ session) |
| `portfolios.js` | общая очередь Supabase: `listPortfoliosForReview` / `submitPortfolio` / `submitPortfolioReview` + `formatPortfolioRole` |
| `referrals.js` | validate / redeem (stub) |

См. [`SCREENS.md`](../../SCREENS.md).
