# `brand-screen-visual` — правый visual brand-экрана

Mesh + noise + марка. Общий для referral / auth / auth-code / url / shell.

## API

```js
createBrandScreenVisual({
  classPrefix?: "url-screen",
  markClassName?: "url-screen__brand-mark",
  withBrandSlot?: false,   // true на UrlScreen (preview / done align)
  markPending?: false,     // shell: SVG вставляет consumer
}) → {
  root, glow, brand, brandSlot, meshWash,
  bindScreenRoot(section),
  setActive(boolean),
  setVariant("default" | "invalid" | "done"),
  getVariant(),
  getMarkSvg(),
  ensureMark(),
}
```

Перед `setVariant` обязателен `bindScreenRoot(screenRoot)` — классы `--invalid` / `--done` вешаются на `section`, не на visual.

## Варианты

| Variant | Класс на screen | Марка | Mesh tokens |
|---------|-----------------|-------|-------------|
| `default` | — | default blob | `--url-screen-mesh-*` |
| `invalid` | `url-screen--invalid` | evil (flame) | `--url-screen-error-mesh-*` (= ban) |
| `done` | `url-screen--done` | logo-done (корона) | `--shell-review-mesh-done-*` |

Смена палитры: `meshWash.transitionToCssColors`. Motion: `--motion-field-error-visual-*` (invalid), `--shell-review-mesh-done-*` / brand-mark morph (done).

## Связь с полем

Ошибка инпута → `setUrlScreenFieldInvalid` / `setUrlScreenOtpInvalid` ([`urlScreenField.js`](../../utils/urlScreenField.js)) **и** `visual.setVariant("invalid"|"default")`.

## Разметка

```
visual
  glow      ← ShaderMount mesh
  noise
  brand     ← mark SVG  |  brand-slot → SVG (withBrandSlot)
```

Доп. узлы (preview на UrlScreen): `visual.root.insertBefore(preview, visual.brand)`.

## Shell

[`BrandScreenShell`](../brand-screen-shell/README.md) монтирует этот компонент (`markPending: true`); SVG марки — снаружи.
