# Экраны приложения — архитектура

Карта экранов «Обратки», path-роутинг и ветки с Home.

Статус: **продуктовый флоу wired**. Onboarding проходимый; Home — хаб с mock-очередью и stub-кошельком; success — пресеты.

## Продуктовый флоу

```text
referral → auth → onboarding → home
                              ├─ pick → review → quiz → /quiz/done (review-panel done)
                              └─ submit (url) → /done (success-screen portfolioSubmitted)
```

| Шаг | Экран | Path | Смысл |
|-----|--------|------|--------|
| 1 | `referral-screen` | `/referral` | Реферальный код |
| 2 | `auth-screen` | `/registration` | Создание аккаунта |
| 3 | `onboarding-screen` | `/onboarding` | Вопросы профиля |
| 4 | `home-screen` | `/home` | Хаб: очередь + баланс + CTA |
| 5a | iframe-shell | `/review` | Ревью выбранного портфолио |
| 5b | `url-screen` | `/portfolio` | Подача своего URL (нужен баланс) |
| 6 | `review-screen` + `review-panel` | `/quiz` → `/quiz/done` | Квиз; финал слева + улет отчёта |
| 7 | `success-screen` | `/done` | Успех подачи портфолио |

Корень `/` → `resolveEntryScreen(getSession())`. Query (`?ref=`, `?lang=`) сохраняются.

SPA-fallback для GitHub Pages: `npm run build` копирует `dist/index.html` → `dist/404.html`.

## Визуальная база

Экраны **referral / auth / onboarding / url** — split-layout (эталон `UrlScreen`):

| Зона | Классы / роль | Поведение |
|------|----------------|-----------|
| Корень | `.url-screen` (цель: `brand-screen`) | Полноэкранный слой, open/close + transition |
| Левая | `__form-pane` | Меняется по экрану |
| Правая | `__visual` | mesh-wash, noise, бренд-марк |

Смена соседних brand-экранов: `handoff: true` (`brandScreenTransition.js`) — правый visual не переигрывается.

`home-screen` / `success-screen` — отдельные полноэкранные слои.  
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
  portfolios.js           ← mock очередь + submit stub
  wallet.js               ← local balance stub
  onboarding.js

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
| `createAuthScreen` | `/registration` | UI |
| `createOnboardingScreen` | `/onboarding` | UI (min) |
| `createHomeScreen` | `/home` | UI (hub + mock) |
| `createUrlScreen` | `/portfolio` | UI (submit own) |
| iframe-shell + timer | `/review` | UI |
| `createReviewScreen` + `createReviewPanel` | `/quiz` | UI |
| `createSuccessScreen` | `/done` | UI (portfolio submitted) |

### Handoff

```js
go("auth", { handoff: true }); // referral → auth: visual статичен
```

## Стили / motion

Токены: `styles/tokens.css`. Reveal: `--motion-*`, keyframes в `entrance.css`, JS `motionTokens.js`.  
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
| `session.js` | login-сессия + balance stub (localStorage) — **не** путать с `/review` |

## API (stubs → Supabase позже)

`src/api/portfolios.js`, `wallet.js`, `onboarding.js`, `auth.js`, `referrals.js` — см. `src/api/README.md`.

## Дальше

1. Supabase Auth / таблицы / RLS.
2. Боевая валюта, лента, аккаунт на Home.
3. Вынести CSS в `brand-screen.css`.

## Связанные документы

- [`STRUCTURE.md`](STRUCTURE.md)
- [`PROJECT.md`](PROJECT.md)
- [`src/app/README.md`](src/app/README.md)
- [`content/onboarding.md`](content/onboarding.md)
- [`.cursor/README.md`](.cursor/README.md)
