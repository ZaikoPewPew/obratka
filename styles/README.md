# `styles/` — слои стилей

- `tokens.css` — **источник дизайн-токенов** (примитивы → семантика → темы). Правило: `.cursor/rules/design-tokens.mdc`.
- `base.css` — сброс / база.
- `entrance.css` — `@keyframes motion-reveal` / `motion-reveal-scale`.
- `iframe-shell.css` — оболочка `/review`, `.url-screen*`, `.auth-screen*`, `.review-screen*` / `.review-panel*`.
- `brand-screen.css` — **заготовка** выноса общих split-стилей из iframe-shell.
- `home-screen.css` — **заготовка** главной `/home`.

## Motion

Источник: `--motion-*`, `--ease-reveal` в `tokens.css`.

| Токен | Назначение |
|-------|------------|
| `--motion-reveal-*` | появление элементов / шагов квиза |
| `--motion-screen-*` | open/close экранов |
| `--motion-advance-delay` / `--motion-focus-delay` | квиз |
| `--motion-feature-*` / `--motion-report-launch-*` | PDF-лист |
| `--motion-delay-*` / `--motion-stagger` | stagger |
| `--url-screen-reveal-*` | алиасы задержек split-экранов |
| `--auth-screen-*` | divider / provider buttons |
| `--shell-review-*` | квиз / report / done |

Handoff без анимации visual: класс `.url-screen--handoff` + `brandScreenTransition.js`.

CSS: `animation-name: motion-reveal` / `motion-reveal-scale`.  
JS: `src/utils/motionTokens.js`.
