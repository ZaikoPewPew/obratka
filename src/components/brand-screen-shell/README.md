# `brand-screen-shell` — общий split-экран

Цель: один каркас для экранов как у «Ссылка на портфолио» (`/portfolio`).

## Сейчас

- API: `BrandScreenShell.js` — `createBrandScreenShell(opts)` →  
  `{ root, open, close, setContent, getVisualRoot, getBrandVisual, setVariant, meshWash }`.
- Правый visual: [`brand-screen-visual`](../brand-screen-visual/README.md) (`markPending: true` — SVG марки вставляет consumer).
- Пока **referral / auth / url / auth-code** ещё собирают layout сами, но visual берут из того же компонента.
- Onboarding уже на shell (`rootClassName: "url-screen"`).
- Стили shell не вынесены (`styles/brand-screen.css` — заготовка).

## Цель

| Зона | Роль |
|------|------|
| Левая `form-pane` | Слот контента экрана |
| Правая `visual` | `createBrandScreenVisual` — mesh + noise + бренд |

Open/close + handoff: `src/utils/brandScreenTransition.js` (классы url-screen).

## Не делать

- Не дублировать visual в каждом экране.
- Только токены в CSS.

См. [`SCREENS.md`](../../../SCREENS.md), [`brand-screen-visual/README.md`](../brand-screen-visual/README.md), [`url-screen/README.md`](../url-screen/README.md).
