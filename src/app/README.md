# `src/app/` — флоу, сессия и роутинг

Слой над компонентами экранов: порядок шагов, path-URL, skip-правила, локальная сессия пользователя (login).

## Состав

| Файл | Роль |
|------|------|
| `routes.js` | карта `AppRouteId` ↔ path |
| `router.js` | History API + Vite `BASE_URL`, `navigate` / `sync` / `start` |
| `flow.js` | `APP_FLOW`, `SESSION_FLOW`, `resolveEntryScreen`, `resolveAccessibleRoute` |
| `session.js` | login-сессия + balance + `referralCode` / `myReferralCode` в localStorage (`obratka.session`) — не путать с `/review` |

Баланс и профиль дополнительно синкаются с `public.profiles` через `src/api/wallet.js` (`refreshSessionFromProfile`).

`resolveAccessibleRoute`: `/registration` без `referralCode` и без `userId` → обратно на `/referral`.  
Auth-gated deep link (`home` / `settings` / `onboarding` / `report` / `url` / `success` / `review` / `quiz` / `done`) без `userId` → `resolveEntryScreen` (referral или auth по state); с `userId` и без онбординга → `onboarding`.
После логина `main.js` вызывает `redeemReferral` (идемпотентно).
На boot / route / visibility: localStorage `userId` без живой Supabase Auth → `exitAuthenticatedSession` → `/referral` (`reconcileSessionAccess` в `main.js`).

## URL

| Id | Path | Смысл |
|----|------|--------|
| `referral` | `/referral` | Invite gate: `validate_referral` → session.referralCode |
| `auth` | `/registration` | Email → code screen / Telegram / Google |
| `authCode` | `/registration/code` | 6-digit Email OTP + resend cooldown |
| `onboarding` | `/onboarding` | Онбординг → profiles |
| `home` | `/home` | Хаб: SWR feed/mine/rating + feedSeen/3/3 + «Топы в сети» + tabbar-dock (entrance / glass / `--on-dark`) + меню профиля |
| `settings` | `/settings` | Отдельный экран настроек (пока заглушка) |
| `url` | `/portfolio` | Подача URL; back-chip → home; done на том же экране |
| `review` | `/review` | Ревью: iframe + таймер 45 s (pause / external wall-clock + `Timer-end.wav`) + чип rec |
| `quiz` | `/quiz` | Квиз / опрос после таймера; микрофон в поле «Главный совет» |
| `done` | `/quiz/done` | Финал квиза (review-panel done + улет отчёта) |
| `success` | `/done` | Успех подачи портфолио (success-screen) |
| `report` | `/report` | Отчёт автору (листы + жалоба) |
| `banned` | `/banned` | Аккаунт заблокирован (ban-screen); escape-proof |

Корень `/` → `resolveEntryScreen(getSession())`. Query вроде `?ref=` / `?lang=` сохраняются.  
Google OAuth return обрабатывается в `main.js` до роутинга (`completeOAuthFromUrl`); ошибка → `obratka.authProviderError` → показ на `auth`.  
`session.banned` синкается из `profiles.banned_at` (`applyProviderUser` / `refreshSessionFromProfile` / `reconcileSessionAccess`); при `true` любой маршрут → `banned` (JWT жив, пока сам не «Выйти»).

На GitHub Pages SPA-fallback: `dist/404.html` (= копия `index.html`) из `npm run build`.

## Порядок экранов

```text
referral → auth → (authCode) → onboarding → home
  home → settings
  home → (intro modal) → claim → review → quiz → /quiz/done
  home (Мои, все слоты) → report
  home (Мои, не готово) → homeMineNotReady*
  home → url → done на url-screen (+ syncRoute /done; success-screen — deep link / generic)
```

Auth-защита и Dashboard: [`auth-screen/README.md`](../components/auth-screen/README.md).  
Brand visual / field errors: [`brand-screen-visual`](../components/brand-screen-visual/README.md), [`FIELD_ERROR.md`](../utils/FIELD_ERROR.md).  
Home: [`home-screen/README.md`](../components/home-screen/README.md) (`homeRoute` query, feed/mine/rating топ-50, SWR `homeListCache`, intro до claim, mine report gate, feedSeen/3/3, «Топы в сети», tabbar-dock + submit, entrance cascade).
Url: [`url-screen/README.md`](../components/url-screen/README.md) (back-chip + done).  
Надиктовка (`/review` + поле совета): [`lib/dictation/README.md`](../lib/dictation/README.md).  
См. корневой [`SCREENS.md`](../../SCREENS.md).

## Правило

Компоненты не знают о следующем экране — только колбэки. Переходы и URL — через `go()` / роутер в `main.js`.  
Ошибки полей на brand-экранах — через utils + `setVariant`, не локальный хардкод обводки.
