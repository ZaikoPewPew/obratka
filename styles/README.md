# `styles/` — слои стилей

- `tokens.css` — **источник дизайн-токенов** (примитивы → семантика → темы). Правило: `.cursor/rules/design-tokens.mdc`.
- `base.css` — сброс / база.
- `entrance.css` — `@keyframes motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar` (без filter — для прозрачных хедеров).
- `iframe-shell.css` — оболочка `/review`, `.url-screen*`, `.auth-screen*` (в т.ч. OTP), `.review-screen*` / `.review-panel*`.
- `brand-screen.css` — **заготовка** выноса общих split-стилей из iframe-shell.
- `home-screen.css` — главная `/home` (absolute topbar + лента карточек).
- `success-screen.css` — `/done` (пресеты успеха).
- `ban-screen.css` — `/banned` (блок аккаунта, красный mesh).

## Что подключено из `index.html`

`tokens.css` → `base.css` → `entrance.css` → `iframe-shell.css` → `success-screen.css` → `ban-screen.css` → `home-screen.css`.

**Не подключены** (legacy waitlist): `desktop.css`, `mobile.css`, `apply.css`, `access-modal.css`, `notification.css`, `privacy-policy-panel.css`.

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
| `--auth-screen-*` | divider / providers / OTP hint / links |
| `--auth-code-*` | ячейки OTP / caret / `--auth-code-resend-cooldown` |
| `--shell-review-*` | квиз / report / done |
| `--home-screen-*` | topbar / feed / avatar / locked-modal |

Handoff без анимации visual: класс `.url-screen--handoff` + `brandScreenTransition.js`.

CSS: `animation-name: motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar`.  
JS: `src/utils/motionTokens.js` (`getScreenCloseFallbackMs`, `getAuthCodeResendCooldownMs`, …).
