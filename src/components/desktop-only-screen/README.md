# `desktop-only-screen` — только десктоп

Не маршрут флоу и не path. Полный оверлей, пока viewport **&lt; 768px**.

Продукт (ревью в iframe) пока рассчитан на большой экран: на телефоне / узком окне показываем заглушку и **не** пускаем в UI.

SoT политики и QA: [`mobile.md`](../../../mobile.md). Карта: [`SCREENS.md`](../../../SCREENS.md).

## Layout

Mobile-first (гейт виден только на узком):

1. Full-bleed visual — mesh (`--url-screen-mesh-*`, не ban) + noise + обычный blob `brandMarkSvg` (44×49).
2. Карточка снизу — тайтл + body на `--color-bg`.

**Не** использует `createBrandScreenVisual` / `setVariant` — статичный wash через `mountMeshGradientWash`, как у ban/success, но с дефолтным mesh.

## Поведение (оркестрация в `main.js`)

| Триггер | Действие |
|---------|----------|
| Boot / `matchMedia` &lt; 768 | `open()`, `body.desktop-only-gated`, `desktop_only_gate_shown` (1× за load) |
| Mid-review сужение | silent abort: release claim, без монет, `go("home")` |
| Deep link review/quiz/done | redirect `/home` под оверлеем |
| `claimAndStartReview` | `return false` пока гейт / узкий viewport |
| Ресайз ≥ 768 | `close()` → `applyDocumentI18n()` |

## Копирайт

| Ключ | RU | EN |
|------|----|----|
| `desktopOnlyTitle` | Пока только с компьютера | Desktop only for now |
| `desktopOnlyBody` | Ревью портфолио рассчитано на большой экран — открой Обратку с ноутбука или десктопа | Portfolio review is built for a large screen — open Obratka on a laptop or desktop |
| `metaTitleDesktopOnly` | Обратка — только с компьютера | Obratka — desktop only |

На `open()` — `document.title = metaTitleDesktopOnly`. Висячие предлоги — `fixHangingPrepositions`.

Кнопок CTA нет (нет «продолжить на мобилке»).

## API

```js
createDesktopOnlyScreen() → { root, open, close }
```

Монтаж: `document.body.append(desktopOnlyScreen.root)` в `main.js`.  
Viewport helpers: [`src/utils/viewport.js`](../../utils/viewport.js).

## Стили / токены

- CSS: [`styles/desktop-only-screen.css`](../../../styles/desktop-only-screen.css)
- Токены: `--desktop-only-screen-*` (z выше toast, padding, card, brand size)
- Motion: `motion-reveal` / `motion-reveal-scale` + `prefers-reduced-motion`
