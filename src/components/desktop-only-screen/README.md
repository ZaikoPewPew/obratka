# `desktop-only-screen` — только десктоп

Не маршрут флоу и не path. Полный оверлей, пока viewport **&lt; 768px**.

Продукт (ревью в iframe) пока рассчитан на большой экран: на телефоне / узком окне показываем заглушку и **не** пускаем в UI.

SoT политики и QA: [`mobile.md`](../../../mobile.md). Карта: [`SCREENS.md`](../../../SCREENS.md).

## Layout

Чисто белый экран + одна короткая фраза по центру (`14px` / regular / `--color-text`). Без mesh, бренда и карточки.

## Поведение (оркестрация в `main.js`)

| Триггер | Действие |
|---------|----------|
| Boot / `matchMedia` &lt; 768 | `open()`, `body.desktop-only-gated`, `desktop_only_gate_shown` (1× за load) |
| Mid-review сужение | silent abort: release claim, без монет, `go("home")` |
| Deep link review/quiz/done | redirect `/home` под оверлеем |
| `claimAndStartReview` | `return false` пока гейт / узкий viewport |
| Ресайз ≥ 768 | `close()` → снять override `document.title` |

## Копирайт

| Ключ | RU | EN |
|------|----|----|
| `desktopOnlyTitle` | Ревьюим только с компа | Reviews only from a computer |
| `metaTitleDesktopOnly` | Обратка — только с компьютера | Obratka — desktop only |

`document.title` на `open()` — override `metaTitleDesktopOnly` из `syncDesktopOnlyGate` в `main.js` (`setDocumentTitleOverride`); на `close()` override снимается, возвращается тайтл текущего роута. Висячие предлоги в UI-фразе — `fixHangingPrepositions`.

Кнопок CTA нет (нет «продолжить на мобилке»).

## API

```js
createDesktopOnlyScreen() → { root, open, close }
```

Монтаж: `document.body.append(desktopOnlyScreen.root)` в `main.js`.  
Viewport helpers: [`src/utils/viewport.js`](../../utils/viewport.js).

## Стили / токены

- CSS: [`styles/desktop-only-screen.css`](../../../styles/desktop-only-screen.css)
- Токены: `--desktop-only-screen-*` (z выше toast, белый bg, 14px / 400 / gray-900)
- Motion: fade `opacity` + `prefers-reduced-motion`
