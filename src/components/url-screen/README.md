# `url-screen` — ссылка на портфолио

Полноэкранный ввод URL портфолио перед iframe-сессией.

## Роль в архитектуре

**Эталон visual** для split-экранов: левая форма + правый mesh/бренд.

При реализации `brand-screen-shell` этот экран нужно перевести на общий каркас без смены внешнего вида. Новые экраны (referral / auth / onboarding) копируют правую часть отсюда.

См. [`SCREENS.md`](../../../SCREENS.md).

## Файл

- `UrlScreen.js` — `createUrlScreen({ onSubmit })` → `{ root, open, close }`.

## Появление (motion)

При `open()` корень получает `.url-screen--open`. Элементы входят staggered через общий слой `--motion-*` / `motion-reveal`:

| Элемент | Эффект | Токен задержки |
|---------|--------|----------------|
| Visual | fade + slide up + blur | `--url-screen-reveal-delay-visual` → `--motion-delay-1` |
| Title | то же | `--url-screen-reveal-delay-title` → `--motion-delay-2` |
| Field | то же | `--url-screen-reveal-delay-field` → `--motion-delay-3` |
| Platforms text | то же | `--url-screen-reveal-delay-platforms` → `--motion-delay-4` |
| Avatars | scale + fade (по очереди) | platforms + n × `--motion-stagger` |
| Brand mark | scale + fade | `--url-screen-reveal-delay-brand` → `--motion-delay-5` |

Правки «ощущения» анимации — в `--motion-reveal-*` / `--ease-reveal` (`styles/tokens.css`).  
Keyframes: `styles/entrance.css`. Экранные задержки можно тюнить через `--url-screen-reveal-delay-*`.  
`prefers-reduced-motion: reduce` — анимации отключаются.

## Стили

Сейчас: `.url-screen*` в `styles/iframe-shell.css`, токены `--url-screen-*` в `tokens.css`.  
Цель: общие правила → `styles/brand-screen.css` / `--brand-screen-*` (reveal унаследовать в shell).
