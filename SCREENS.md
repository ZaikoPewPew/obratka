# Экраны приложения — архитектура

Карта экранов «Обратки», path-роутинг и связь с `url-screen` / iframe / квизом.

Статус: **роутинг работает**. UI: referral + auth + url + review/quiz готовы; onboarding/home — stub (монтируются, deep link’и живые).

## Продуктовый флоу

```text
referral → auth → onboarding → home → portfolio → review → quiz → quiz/done
   │         │         │          │         │         │       │         │
   UI        UI       stub       stub      UI        UI      UI        UI
```

| Шаг | Экран | Path | Смысл |
|-----|--------|------|--------|
| 1 | `referral-screen` | `/referral` | Реферальный код |
| 2 | `auth-screen` | `/registration` | Создание аккаунта |
| 3 | `onboarding-screen` | `/onboarding` | Вопросы профиля (stub) |
| 4 | `home-screen` | `/home` | Очередь портфолио (stub) |
| 5 | `url-screen` | `/portfolio` | Ссылка на портфолио |
| 6 | iframe-shell | `/review` | Ревью: просмотр + таймер |
| 7 | `review-screen` + `review-panel` | `/quiz` | Квиз / опрос |
| 8 | done | `/quiz/done` | Финал квиза |

Сейчас после auth сразу `/portfolio` (онбординг/home пропускаются в happy-path, но URL открывают stub).

Корень `/` → `resolveEntryScreen` (обычно `/referral`). Код: `src/app/routes.js` + `router.js`. Query (`?ref=`, `?lang=`) сохраняются. Prefill рефералки: `?ref=`.

SPA-fallback для GitHub Pages: `npm run build` копирует `dist/index.html` → `dist/404.html`.

## Визуальная база

Экраны **referral / auth / onboarding / url** — split-layout (эталон `UrlScreen`):

| Зона | Классы / роль | Поведение |
|------|----------------|-----------|
| Корень | `.url-screen` (цель: `brand-screen`) | Полноэкранный слой, open/close + transition |
| Левая | `__form-pane` | Меняется по экрану |
| Правая | `__visual` | mesh-wash, noise, бренд-марк |

Смена соседних brand-экранов: `handoff: true` (`brandScreenTransition.js`) — правый visual не переигрывается.

`home-screen` — другой лейаут (очередь).  
`review-screen` — split для квиза (слева panel, справа visual + PDF-лист).

## Дерево файлов

```text
SCREENS.md

src/app/
  routes.js / router.js / flow.js / session.js
  README.md

src/components/
  brand-screen-shell/     ← каркас (пока stub API)
  referral-screen/        ← UI готов
  auth-screen/            ← UI готов
  onboarding-screen/      ← stub
  home-screen/            ← stub
  url-screen/             ← эталон split
  review-screen/          ← оболочка квиза + report reveal
  review-panel/           ← шаги квиза + done

styles/
  tokens.css
  iframe-shell.css        ← url-screen, review-*, auth extras
  brand-screen.css        ← заготовка выноса
  home-screen.css         ← заготовка
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
| `createOnboardingScreen` | `/onboarding` | stub |
| `createHomeScreen` | `/home` | stub |
| `createUrlScreen` | `/portfolio` | UI |
| iframe-shell + timer | `/review` | UI |
| `createReviewScreen` + `createReviewPanel` | `/quiz`, `/quiz/done` | UI |

Подробности API — README в папках компонентов.

### Handoff

```js
go("auth", { handoff: true }); // referral → auth: visual статичен
```

## Стили / motion

Токены: `styles/tokens.css`. Reveal: `--motion-*`, keyframes в `entrance.css`, JS `motionTokens.js`.  
Правило: `.cursor/rules/design-tokens.mdc`.

## i18n

Все UI-строки — `content/locales.json` (`referral*`, `auth*`, `onboarding*`, `home*`, `review*` / `report*`).  
Правило: `.cursor/rules/i18n.mdc`.

## App-слой

| Файл | Роль |
|------|------|
| `routes.js` | id ↔ path |
| `router.js` | History API + `BASE_URL` |
| `flow.js` | порядок, entry, deep-link access |
| `session.js` | login-сессия (localStorage) — **не** путать с `/review` |

## API (будущее)

`src/api/auth.js`, `referrals.js`, `portfolios.js`, `onboarding.js` — см. `src/api/README.md`.

## Дальше

1. Вынести CSS в `brand-screen.css`, перевести url/referral/auth на shell.
2. UI onboarding + home, вернуть их в happy-path после auth.
3. Реальный auth / referrals API.

## Связанные документы

- [`STRUCTURE.md`](STRUCTURE.md)
- [`PROJECT.md`](PROJECT.md)
- [`src/app/README.md`](src/app/README.md)
- [`content/onboarding.md`](content/onboarding.md)
- [`.cursor/README.md`](.cursor/README.md)
