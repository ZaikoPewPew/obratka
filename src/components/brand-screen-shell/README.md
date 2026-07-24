# `brand-screen-shell` — общий split-экран

Каркас: левый слот контента + правый [`brand-screen-visual`](../brand-screen-visual/README.md).

## API

```js
createBrandScreenShell({
  labelledById: "…",
  content: leftPaneElement,
  rootClassName: "url-screen", // или будущий "brand-screen"
}) → {
  root, open, close,
  setContent(el),
  getVisualRoot(),      // visual.root
  getBrandVisual(),     // полный createBrandScreenVisual()
  setVariant(v),        // proxy → visual.setVariant
  meshWash,
}
```

Open/close + handoff: [`brandScreenTransition.js`](../../utils/brandScreenTransition.js) (классы `url-screen` / `url-screen--open` / `--handoff`).

## Сейчас

| Кто | Shell? | Visual |
|-----|--------|--------|
| onboarding | **да** (`rootClassName: "url-screen"`) | shell (`markPending`); SVG вставляет экран |
| referral / auth / auth-code / url | layout сами | `createBrandScreenVisual` напрямую |

Стили shell не вынесены (`styles/brand-screen.css` — заготовка); классы пока `.url-screen*`.

## Цель

Все split-экраны на shell; левая колонка — только контент экрана; visual не копипастить.

## Не делать

- Не собирать glow/noise/brand вручную рядом с shell.
- Только токены в CSS.

См. [`brand-screen-visual/README.md`](../brand-screen-visual/README.md), [`FIELD_ERROR.md`](../../utils/FIELD_ERROR.md) (ошибки полей на экранах поверх shell), [`SCREENS.md`](../../../SCREENS.md), [`url-screen/README.md`](../url-screen/README.md).
