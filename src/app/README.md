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

`resolveAccessibleRoute`: `/registration` и `/registration/code` без `referralDone` (нет `referralCode` и нет device `inviteGatePassed`) и без `userId` → обратно на `/referral`. При email off `/registration/code` с гейтом → `/registration` (экран OTP недоступен).  
Auth-gated deep link (`home` / `settings` / `onboarding` / `report` / `url` / `success` / `review` / `quiz` / `done`) без `userId` → `resolveEntryScreen` (referral или auth по state); с `userId` и без онбординга → `onboarding`.
После логина `main.js` вызывает `redeemReferral` (идемпотентно).
На boot / route / visibility: localStorage `userId` без живой Supabase Auth → `exitAuthenticatedSession` → `/registration` при `inviteGatePassed`, иначе `/referral` (`reconcileSessionAccess` в `main.js`).

## URL

| Id | Path | Смысл |
|----|------|--------|
| `referral` | `/referral` | Invite gate: `validate_referral` → session.referralCode + `obratka.inviteGatePassed` |
| `auth` | `/registration` | Telegram / Google (Email OTP скрыт: `EMAIL_AUTH_ENABLED`) |
| `authCode` | `/registration/code` | 6-digit Email OTP + resend cooldown; без гейта → `/referral`; с гейтом и без флага → `/registration` |
| `onboarding` | `/onboarding` | Онбординг → profiles |
| `home` | `/home` | Хаб: SWR feed/mine (рейтинг UI off, `RATING_TAB_ENABLED`) + feedSeen/3/3 + «Топы в сети» + tabbar-dock (entrance / glass / `--on-dark`) + меню профиля |
| `settings` | `/settings` | Профиль в side-panel поверх home (view-only, без Save) |
| `url` | `/portfolio` | Подача URL; back-chip → home; done на том же экране |
| `review` | `/review` | Ревью: iframe + таймер 60 s (pause / external wall-clock + `Timer-end.wav`) + чип rec |
| `quiz` | `/quiz` | Квиз после таймера; шкалы context/visual 1–5 ([`scale-slider`](../components/scale-slider/README.md)); условный pain; рыночный `tier`; микрофон в поле «Главный совет» |
| `done` | `/quiz/done` | Финал квиза (review-panel done + улет отчёта) |
| `success` | `/done` | Успех подачи портфолио (success-screen) |
| `report` | `/report` | Отчёт автору (листы → side-panel → жалоба) |
| `banned` | `/banned` | Аккаунт заблокирован (ban-screen); escape-proof |
| `notFound` | `/404` | Неизвестный path (not-found-screen); CTA → home / registration |

**Не path:** `desktop-only-screen` — оверлей при viewport &lt; 768px (`mobile.md`); review/claim не стартуют.

`document.title` по id: [`documentTitle.js`](../utils/documentTitle.js) (`applyDocumentTitle` из `applyRoute` / `syncRoute`; ключи `metaTitle*` в `locales.json`). Desktop-only — override, не роут.

Корень `/` → `resolveEntryScreen(getSession())`. Query вроде `?ref=` / `?lang=` сохраняются.  
Неизвестный path (не `/`, не в `ROUTE_PATHS`) → `go("notFound")` → `/404`.  
Google OAuth return обрабатывается в `main.js` до роутинга (`completeOAuthFromUrl`); ошибка → `obratka.authProviderError` → показ на `auth`.  
`session.banned` синкается из `profiles.banned_at` (`applyProviderUser` / `refreshSessionFromProfile` / `reconcileSessionAccess`); при `true` любой маршрут → `banned` (JWT жив, пока сам не «Выйти»).

На GitHub Pages SPA-fallback: `dist/404.html` (= копия `index.html`) из `npm run build` — entry для deep links, не продуктовый not-found UI.

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
Home: [`home-screen/README.md`](../components/home-screen/README.md) (`homeRoute` query feed/mine + `RATING_TAB_ENABLED` remap `?tab=rating` → feed, SWR `homeListCache` feed/feedReviewed/mine/rating, Ждёт/Уже + Ещё/Завершенные, intro до claim, mine report gate, feedSeen/3/3, «Топы в сети», tabbar-dock + submit, entrance cascade).
Url: [`url-screen/README.md`](../components/url-screen/README.md) (back-chip + done).  
Надиктовка (`/review` + поле совета): [`lib/dictation/README.md`](../lib/dictation/README.md).  
Post-edit пунктуации: [`dictationPolish.js`](../api/dictationPolish.js) → Edge [`polish-dictation`](../../supabase/functions/polish-dictation/README.md) (**сейчас off** — `POLISH_ENABLED = false`).  
См. корневой [`SCREENS.md`](../../SCREENS.md).

## Правило

Компоненты не знают о следующем экране — только колбэки. Переходы и URL — через `go()` / роутер в `main.js`.  
Ошибки полей на brand-экранах — через utils + `setVariant`, не локальный хардкод обводки.
