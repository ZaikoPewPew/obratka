# `brand-screen-shell` — общий split-экран

Каркас: левый слот контента + правый [`brand-screen-visual`](../brand-screen-visual/README.md).

## API

```js
createBrandScreenShell({
  labelledById: "…",
  content: leftPaneElement,
  rootClassName: "url-screen", // или будущий "brand-screen"
  withBrandSlot: false,
  markPending: false,
}) → {
  root, open, close,
  setContent(el),
  getFormPane(),
  getVisualRoot(),      // visual.root
  getBrandVisual(),     // полный createBrandScreenVisual()
  setVariant(v),        // proxy → visual.setVariant
  meshWash,
}
```

`open({ handoff, prepare })` / `close({ handoff })` — через [`brandScreenTransition.js`](../../utils/brandScreenTransition.js) (классы `url-screen` / `url-screen--open` / `--handoff`).

## Кто на shell

| Экран | Shell | Visual notes |
|-------|-------|--------------|
| referral | да | default mark |
| auth | да | default mark |
| auth-code | да | default mark; `auth-code-screen__pane` на form-pane |
| onboarding | да | `markPending: true` — SVG вставляет экран |
| url | да | `withBrandSlot: true` + preview sheet |

Стили shell не вынесены (`styles/brand-screen.css` — заготовка); классы пока `.url-screen*`.

## Не делать

- Не собирать glow/noise/brand вручную рядом с shell.
- Только токены в CSS.

См. [`brand-screen-visual/README.md`](../brand-screen-visual/README.md), [`FIELD_ERROR.md`](../../utils/FIELD_ERROR.md) (ошибки полей на экранах поверх shell), [`SCREENS.md`](../../../SCREENS.md), [`url-screen/README.md`](../url-screen/README.md).
