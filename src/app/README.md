# `src/app/` — флоу, сессия и роутинг

Слой над компонентами экранов: порядок шагов, path-URL, skip-правила, локальная сессия пользователя (login).

## Состав

| Файл | Роль |
|------|------|
| `routes.js` | карта `AppRouteId` ↔ path |
| `router.js` | History API + Vite `BASE_URL`, `navigate` / `sync` / `start` |
| `flow.js` | `APP_FLOW`, `SESSION_FLOW`, `resolveEntryScreen`, `resolveAccessibleRoute` |
| `session.js` | login-сессия + `balance` stub в localStorage (`obratka.session`) — не путать с `/review` |

## URL

| Id | Path | Смысл |
|----|------|--------|
| `referral` | `/referral` | Реферальный код |
| `auth` | `/registration` | Регистрация |
| `onboarding` | `/onboarding` | Онбординг |
| `home` | `/home` | Главная (хаб) |
| `url` | `/portfolio` | Подача своего портфолио |
| `review` | `/review` | Ревью: iframe + таймер |
| `quiz` | `/quiz` | Квиз / опрос после таймера |
| `done` | `/done` | Успех (пресеты success-screen) |

Корень `/` → `resolveEntryScreen(getSession())`. Query вроде `?ref=` / `?lang=` сохраняются.

На GitHub Pages SPA-fallback: `dist/404.html` (= копия `index.html`) из `npm run build`.

## Порядок экранов

```text
referral → auth → onboarding → home
  home → review → quiz → done (quizComplete)
  home → url → done (portfolioSubmitted)
```

См. корневой [`SCREENS.md`](../../SCREENS.md).

## Правило

Компоненты не знают о следующем экране — только колбэки. Переходы и URL — через `go()` / роутер в `main.js`.
