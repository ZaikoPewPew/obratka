# `styles/` — слои стилей

- `tokens.css` — **единый источник дизайн-токенов** (примитивы → семантика → темы). См. `.cursor/rules/design-tokens.mdc`.
- `base.css` — сброс и базовые правила.
- `iframe-shell.css` — оболочка сессии, `.url-screen`, `.review-screen` / `.review-panel` (опрос + финальный reveal PDF).
- `entrance.css` — общий page-entrance reveal (legacy/опционально; url-screen использует свои keyframes).
- `brand-screen.css` — **заготовка**: общие стили split-экранов (вынести из `iframe-shell` при реализации shell).
- `home-screen.css` — **заготовка**: главная / очередь на ревью.

## Motion url-screen / review-screen

Токены `--url-screen-reveal-*` и `--shell-review-*` в `tokens.css`. Анимации в `iframe-shell.css`.  
Документация: `src/components/url-screen/README.md`, `src/components/review-screen/README.md`, [`SCREENS.md`](../SCREENS.md).
