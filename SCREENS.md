# Экраны приложения — архитектура

Карта экранов «Обратки», path-роутинг и ветки с Home.

Статус: **продуктовый флоу wired**. Auth: Telegram + Google OAuth → `profiles`. Onboarding пишет в Supabase. Home — хаб (mock-очередь + баланс из `profiles`). Submit URL — done на url-screen; success — пресеты / deep link.

## Продуктовый флоу

```text
referral → auth → onboarding → home
                              ├─ pick → review → quiz → /quiz/done (review-panel done)
                              └─ submit (url) → done на url-screen → /done (URL sync)
```

| Шаг | Экран | Path | Смысл |
|-----|--------|------|--------|
| 1 | `referral-screen` | `/referral` | Реферальный код |
| 2 | `auth-screen` | `/registration` | Telegram / Google / email UI |
| 3 | `onboarding-screen` | `/onboarding` | Вопросы профиля → `profiles` |
| 4 | `home-screen` | `/home` | Хаб: очередь + баланс + CTA |
| 5a | iframe-shell | `/review` | Ревью выбранного портфолио |
| 5b | `url-screen` | `/portfolio` | Подача своего URL (нужен баланс) |
| 6 | `review-screen` + `review-panel` | `/quiz` → `/quiz/done` | Квиз; финал слева + улет отчёта |
| 7 | `success-screen` | `/done` | Успех подачи: тайтл + «Выйти», зелёный mesh справа |

Корень `/` → `resolveEntryScreen(getSession())`. Query (`?ref=`, `?lang=`) сохраняются.  
OAuth return (Google hash/query) → `completeOAuthFromUrl()` в `main.js` → onboarding / home.

SPA-fallback для GitHub Pages: `npm run build` копирует `dist/index.html` → `dist/404.html`.

## Визуальная база

Экраны **referral / auth / onboarding / url** — split-layout (эталон `UrlScreen`):

| Зона | Классы / роль | Поведение |
|------|----------------|-----------|
| Корень | `.url-screen` (цель: `brand-screen`) | Полноэкранный слой, open/close + transition |
| Левая | `__form-pane` | Меняется по экрану |
| Правая | `__visual` | mesh-wash, noise, бренд-марк |

Смена соседних brand-экранов: `handoff: true` (`brandScreenTransition.js`) — правый visual не переигрывается.

`home-screen` — отдельный полноэкранный слой (absolute topbar поверх ленты).  
`url-screen` — split; при URL справа заглушка «Портфолио»; submit → done на том же экране (как quiz).  
`success-screen` — запасной `/done` (deep link); основной submit больше не прыгает сюда.  
`review-screen` — split для квиза (слева panel, справа visual + PDF-лист).

## Дерево файлов

```text
SCREENS.md

src/app/
  routes.js / router.js / flow.js / session.js
  README.md

src/components/
  brand-screen-shell/
  referral-screen/
  auth-screen/
  onboarding-screen/
  home-screen/
  url-screen/
  review-screen/
  review-panel/           ← только шаги квиза
  success-screen/         ← /done (подача портфолио)

src/api/
  auth.js / profiles.js / onboarding.js / wallet.js
  portfolios.js           ← mock очередь + submit stub
  referrals.js            ← stub
  telegramWidget.js / subscribers.js

styles/
  tokens.css
  iframe-shell.css
  home-screen.css
  success-screen.css
  entrance.css

content/
  locales.json
  onboarding.json / onboarding.md
```

## Контракты

Паттерн: фабрика → `{ root, open, close, … }`. Монтаж и URL — из `main.js` (`go` / `applyRoute`). Компонент **не** знает следующий экран.

| Фабрика | Path | Статус |
|---------|------|--------|
| `createReferralScreen` | `/referral` | UI |
| `createAuthScreen` | `/registration` | UI + Telegram/Google |
| `createOnboardingScreen` | `/onboarding` | UI → profiles |
| `createHomeScreen` | `/home` | UI (hub + mock feed) |
| `createUrlScreen` | `/portfolio` | UI (submit own + done) |
| iframe-shell + timer | `/review` | UI |
| `createReviewScreen` + `createReviewPanel` | `/quiz` | UI |
| `createSuccessScreen` | `/done` | UI (portfolio submitted) |

### Handoff

```js
go("auth", { handoff: true }); // referral → auth: visual статичен
```

## Стили / motion

Токены: `styles/tokens.css`. Reveal: `--motion-*`, keyframes в `entrance.css` (в т.ч. `motion-reveal-topbar`), JS `motionTokens.js`.  
Правило: `.cursor/rules/design-tokens.mdc`.

## i18n

Все UI-строки — `content/locales.json` (`referral*`, `auth*`, `onboarding*`, `home*`, `success*`, `review*` / `report*`).  
Правило: `.cursor/rules/i18n.mdc`.

## App-слой

| Файл | Роль |
|------|------|
| `routes.js` | id ↔ path |
| `router.js` | History API + `BASE_URL` |
| `flow.js` | порядок, entry, deep-link access |
| `session.js` | login-сессия + balance в localStorage (`obratka.session`) — **не** путать с `/review` |

## API

`src/api/` — Auth (Telegram/Google), profiles, onboarding, wallet sync, portfolios stub. См. `src/api/README.md`.

## Дальше

1. Боевая лента / аккаунт вместо mock seed.
2. Email auth через Supabase.
3. Вынести CSS в `brand-screen.css`.

## Связанные документы

- [`STRUCTURE.md`](STRUCTURE.md)
- [`PROJECT.md`](PROJECT.md)
- [`src/app/README.md`](src/app/README.md)
- [`content/onboarding.md`](content/onboarding.md)
- [`.cursor/README.md`](.cursor/README.md)
