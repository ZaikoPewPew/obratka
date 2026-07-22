# `styles/` — слои стилей

- `tokens.css` — **единый источник дизайн-токенов** (примитивы → семантика → темы). См. `.cursor/rules/design-tokens.mdc`.
- `base.css` — сброс и базовые правила.
- `entrance.css` — общий motion-слой: `@keyframes motion-reveal` / `motion-reveal-scale`, утилиты `.motion-reveal*`.
- `iframe-shell.css` — оболочка сессии, `.url-screen`, `.review-screen` / `.review-panel` (опрос + финальный reveal PDF).
- `brand-screen.css` — **заготовка**: общие стили split-экранов (вынести из `iframe-shell` при реализации shell).
- `home-screen.css` — **заготовка**: главная / очередь на ревью.

## Motion

Источник правды: `--motion-*` и `--ease-reveal` в `tokens.css`.

| Токен | Назначение |
|-------|------------|
| `--motion-reveal-*` | появление элементов и смена шагов (fade + slide/scale + blur) |
| `--motion-screen-*` | open/close экранов (url → сессия, сессия → опрос) |
| `--motion-advance-delay` | пауза перед auto-advance шага |
| `--motion-focus-delay` | фокус после open опроса |
| `--motion-feature-*` | PDF-лист и уезд лого |
| `--motion-delay-*` / `--motion-stagger` | ступени stagger |
| `--url-screen-reveal-*` | алиасы задержек экрана ссылки |
| `--shell-review-step-*` / `--shell-review-report-*` | алиасы на `--motion-reveal-*` / `--motion-feature-*` |

В CSS: `animation-name: motion-reveal` / `motion-reveal-scale` (из `entrance.css`).  
В JS: `src/utils/motionTokens.js`.
