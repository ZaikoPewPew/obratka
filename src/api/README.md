# `src/api/` — сетевой слой

Модули для Supabase Auth, профилей, рефералов и продуктового API.

## Auth и профиль

| Файл | Роль |
|------|------|
| `auth.js` | Email OTP (`requestEmailOtp` / `verifyEmailOtp`); Telegram Login → Edge Function; Google OAuth (`signInWithGoogle` / `completeOAuthFromUrl`); `mapSupabaseAuthErrorCode`; `signOut` |
| `telegramWidget.js` | загрузка Login Widget / `Telegram.Login.auth` |
| `profiles.js` | `fetchMyProfile` / `updateMyProfile` / `isProfileBanned` (`public.profiles`; `tier`, `banned_*`, `reputation`, `last_seen_at` только чтение / RPC) |
| `presence.js` | legendary online: `heartbeatLegendaryPresence` / `listOnlineLegendaries` (RPC; только `tier=legendary`) |
| `rating.js` | `listRatingTop` — топ-50 по `reputation` для вкладки «Рейтинг» (RPC `list_rating_top`; серверный снапшот раз в сутки) |
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
- **Manual linking** / UNIQUE `profiles.email` — roadmap (`PROJECT.md` #2).

Env / Dashboard: `.env.example`, `src/components/auth-screen/README.md`, `supabase/README.md`.

**Dashboard (обязательно для email):** Authentication → Providers → Email → OTP включён; шаблон Magic Link содержит `{{ .Token }}`. Без этого код на `/registration/code` не придёт.

## Кошелёк и портфолио

| Файл | Роль |
|------|------|
| `wallet.js` | `getBalance` / `applySubmitBalance` / `spendSubmitCost` (legacy RPC) / `awardReviewReward` (= refresh) / `creditBalance` (DEV local-only) / `REVIEW_REWARD = 10` / `SUBMIT_COST = 30` (3 ревью → подача); `refreshSessionFromProfile` (перед fetch — `settleReviewReputationRewards`; `reputation` через `clampReputation`) |
| `leagues.js` | матчинг лиг по `grade` (зеркало SQL): `gradeToLeague` / `canReviewGrades`; null/unknown → лига 1 |
| `portfolios.js` | `listPortfoliosForReview` (чужие pending в лиге + слоты; без `reviewedByMe`; порядок `sortFeedForSlotClosure`: closer to target → FIFO; дверь claim = reviewsCount < target (late overshoot ок); запрос ограничен `FEED_QUERY_LIMIT` = 300 по `created_at` DESC — защита от неограниченного select при наплыве регистраций) / `listMyPortfolios` (`created_at` DESC) / `listFeedPortfolioIds` для точки «новый кейс» на «На ревью» (тот же `FEED_QUERY_LIMIT` + exclude reviewed) / `listReadyOwnReportIds` (+ `hasReadyOwnReport`) для точки на «Мои» / claim·heartbeat·release / `releasePortfolioClaimKeepalive` (unload) / `isPortfolioOpenForReview` (`reviewsCount < target`, home gate до intro) / `submitPortfolio` (RPC `submit_portfolio`) / `countMyPendingPortfolios` / `hasFreeMineSlot` / `MAX_MINE_PENDING` (=1) / `submitPortfolioReview` (answers + опционально `dictation`) + `formatPortfolioRole` / `formatPortfolioGrade` (без известного grade → `gradeUndefined`); active-слоты на карточке **анонимны** (`homeCardReviewerAnonymous` — без PII до завершения ревью); abort без залипания — см. `review-claims.mdc` |
| `reviewComplaints.js` | жалобы на листы: `listPortfolioReviewSheets` (с `answers` / `canComplain` от `completed_at`) / `submitReviewComplaint` / `getReputation` / `formatReputation`; теги v1 без весов на клиенте; окно 6ч от done; RPC `submit_review_complaint` + `settle_review_reputation_rewards` |
| `referrals.js` | `validateReferral` / `redeemReferral` / `fetchMyReferral`; реэкспорт `normalizeReferralCode` / `buildReferralShareUrl` / `REFERRAL_MAX_USES` из `utils/referralCode.js` (RPC + seed `YTHWKPDWAK`; **без наград**) |
| `portfolioEmbedProbe.js` | Edge `portfolio-embed-probe`: XFO/CSP → canFrame; `resolvePortfolioEmbedPlan` (sync + probe) для prefetch до `/review` |

См. [`SCREENS.md`](../../SCREENS.md), [`supabase/sql/referrals.sql`](../../supabase/sql/referrals.sql).
