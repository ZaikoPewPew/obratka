# `url-screen` — ссылка на портфолио

Path: **`/portfolio`**. Полноэкранный ввод URL перед ревью (`/review`).

## Роль

**Эталон visual** для split-экранов: левая форма + правый mesh/бренд.  
Referral / auth копируют разметку и классы `.url-screen*`; цель — общий `brand-screen-shell`.

См. [`SCREENS.md`](../../../SCREENS.md).

## Файл

- `UrlScreen.js` — `createUrlScreen({ onSubmit })` → `{ root, open, close }`.
- `open(prefill?, { handoff? })`, `close({ handoff? })` через `brandScreenTransition.js`.

## Поведение

Submit валидного URL → `onSubmit(url)` → в `main.js`: оболочка iframe, `syncRoute("review")`, старт таймера (или arm для external).

## Motion

При `open()` без handoff: `.url-screen--open`, staggered reveal (`--url-screen-reveal-delay-*` → `--motion-delay-*`).  
С `handoff: true`: visual/brand без анимации (соседний brand-экран).

| Элемент | Задержка |
|---------|----------|
| Visual | `--url-screen-reveal-delay-visual` |
| Title | `--url-screen-reveal-delay-title` |
| Field | `--url-screen-reveal-delay-field` |
| Platforms / avatars | `--url-screen-reveal-delay-platforms` + stagger |
| Brand | `--url-screen-reveal-delay-brand` |

Keyframes: `styles/entrance.css`. `prefers-reduced-motion: reduce` — off.

## Стили

`.url-screen*` в `iframe-shell.css`, токены `--url-screen-*` в `tokens.css`.
