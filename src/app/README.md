# `src/app/` — флоу, сессия и роутинг

Слой над компонентами экранов: порядок шагов, path-URL, skip-правила, локальная сессия пользователя (login).

## Состав

| Файл | Роль |
|------|------|
| `routes.js` | карта `AppRouteId` ↔ path |
| `router.js` | History API + Vite `BASE_URL`, `navigate` / `sync` / `start` |
| `flow.js` | `APP_FLOW`, `SESSION_FLOW`, `resolveEntryScreen`, `resolveAccessibleRoute` |
| `session.js` | login-сессия + `balance` в localStorage (`obratka.session`) — не путать с `/review` |

Баланс и профиль дополнительно синкаются с `public.profiles` через `src/api/wallet.js` (`refreshSessionFromProfile`).

## URL

| Id | Path | Смысл |
|----|------|--------|
| `referral` | `/referral` | Реферальный код |
| `auth` | `/registration` | Email → code screen / Telegram / Google |
| `authCode` | `/registration/code` | 6-digit Email OTP + resend cooldown |
| `onboarding` | `/onboarding` | Онбординг → profiles |
| `home` | `/home` | Главная (хаб) |
| `url` | `/portfolio` | Подача своего портфолио |
| `review` | `/review` | Ревью: iframe + таймер |
| `quiz` | `/quiz` | Квиз / опрос после таймера |
| `done` | `/quiz/done` | Финал квиза (review-panel done + улет отчёта) |
| `success` | `/done` | Успех подачи портфолио (success-screen) |
| `banned` | `/banned` | Аккаунт заблокирован (ban-screen); escape-proof |

Корень `/` → `resolveEntryScreen(getSession())`. Query вроде `?ref=` / `?lang=` сохраняются.  
Google OAuth return обрабатывается в `main.js` до роутинга (`completeOAuthFromUrl`); ошибка → `obratka.authProviderError` → показ на `auth`.  
`session.banned` синкается из `profiles.banned_at` (`applyProviderUser` / `refreshSessionFromProfile`); при `true` любой маршрут → `banned`.

На GitHub Pages SPA-fallback: `dist/404.html` (= копия `index.html`) из `npm run build`.

## Порядок экранов

```text
referral → auth → (authCode) → onboarding → home
  home → review → quiz → /quiz/done
  home → url → /done (portfolioSubmitted)
```

Auth-защита и Dashboard: [`auth-screen/README.md`](../components/auth-screen/README.md).  
См. корневой [`SCREENS.md`](../../SCREENS.md).

## Правило

Компоненты не знают о следующем экране — только колбэки. Переходы и URL — через `go()` / роутер в `main.js`.
