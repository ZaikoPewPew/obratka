# `brand-screen-shell` — общий split-экран

Цель: один каркас для экранов как у «Ссылка на портфолио» (`/portfolio`).

## Сейчас

- API: `BrandScreenShell.js` — `createBrandScreenShell(opts)` → `{ root, open, close, setContent, getVisualRoot }`.
- Пока **referral / auth / onboarding / url** копируют разметку `.url-screen*` напрямую (shell API готов, миграция впереди).
- Стили shell не вынесены (`styles/brand-screen.css` — заготовка).

## Цель

| Зона | Роль |
|------|------|
| Левая `form-pane` | Слот контента экрана |
| Правая `visual` | mesh + noise + бренд (общий) |

Потребители после миграции: url, referral, auth, onboarding.

Open/close + handoff: `src/utils/brandScreenTransition.js` (сейчас на классах url-screen).

## Не делать

- Не дублировать visual в каждом экране.
- Только токены в CSS.

См. [`SCREENS.md`](../../../SCREENS.md), [`url-screen/README.md`](../url-screen/README.md).
