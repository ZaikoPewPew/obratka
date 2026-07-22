# `url-screen` — ссылка на портфолио

Полноэкранный ввод URL портфолио перед iframe-сессией.

## Роль в архитектуре

**Эталон visual** для split-экранов: левая форма + правый mesh/бренд.

При реализации `brand-screen-shell` этот экран нужно перевести на общий каркас без смены внешнего вида. Новые экраны (referral / auth / onboarding) копируют правую часть отсюда.

См. [`SCREENS.md`](../../../SCREENS.md).

## Файл

- `UrlScreen.js` — `createUrlScreen({ onSubmit })` → `{ root, open, close }`.

## Появление (motion)

При `open()` корень получает `.url-screen--open`. Элементы входят staggered:

| Элемент | Эффект | Токен задержки |
|---------|--------|----------------|
| Visual | fade + slide up + blur | `--url-screen-reveal-delay-visual` |
| Title | то же | `--url-screen-reveal-delay-title` |
| Field | то же | `--url-screen-reveal-delay-field` |
| Platforms text | то же | `--url-screen-reveal-delay-platforms` |
| Avatars | scale + fade (по очереди) | delay platforms + n × `--url-screen-reveal-avatar-stagger` |
| Brand mark | scale + fade | `--url-screen-reveal-delay-brand` |

Токены длительности/blur/shift: `--url-screen-reveal-*` в `styles/tokens.css`.  
Стили: `styles/iframe-shell.css` (`@keyframes url-screen-reveal`).  
`prefers-reduced-motion: reduce` — анимации отключаются.

## Стили

Сейчас: `.url-screen*` в `styles/iframe-shell.css`, токены `--url-screen-*` в `tokens.css`.  
Цель: общие правила → `styles/brand-screen.css` / `--brand-screen-*` (reveal унаследовать в shell).
