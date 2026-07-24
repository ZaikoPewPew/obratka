# `styles/` — слои стилей

- `tokens.css` — **источник дизайн-токенов** (примитивы → семантика → темы). Правило: `.cursor/rules/design-tokens.mdc`.
- `base.css` — сброс / база.
- `entrance.css` — `@keyframes motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar` (без filter — для прозрачных хедеров).
- `app-modal.css` — универсальная модалка (`createAppModal`, `--app-modal-*`).
- `iframe-shell.css` — оболочка `/review`, `.url-screen*` (в т.ч. `__error*`, `__input-wrap--invalid`), `.auth-screen*` / `.auth-code-screen*` (в т.ч. `__cells--invalid`), `.review-screen*` / `.review-panel*`.
- `brand-screen.css` — **заготовка** выноса общих split-стилей из iframe-shell.
- `home-screen.css` — главная `/home` (absolute topbar + лента карточек).
- `success-screen.css` — `/done` (пресеты успеха).
- `ban-screen.css` — `/banned` (блок аккаунта, красный mesh).

## Что подключено из `index.html`

`tokens.css` → `base.css` → `entrance.css` → `app-modal.css` → `iframe-shell.css` → `success-screen.css` → `report-screen.css` → `ban-screen.css` → `home-screen.css`.

Архив waitlist-CSS удалён (`desktop` / `mobile` / `apply` / `access-modal` / `notification` / `privacy-policy-panel`). Историческая спека: [`mobile.md`](../mobile.md).

## Motion

Источник: `--motion-*`, `--ease-reveal` в `tokens.css`.

| Токен | Назначение |
|-------|------------|
| `--motion-reveal-*` | появление элементов / шагов квиза |
| `--motion-screen-*` | open/close экранов |
| `--motion-field-error-*` | текст ошибки под инпутом (opacity/blur/высота) |
| `--motion-field-error-visual-*` | красный mesh + evil-рожки |
| `--motion-advance-delay` / `--motion-focus-delay` | квиз |
| `--motion-feature-*` / `--motion-report-launch-*` | PDF-лист |
| `--motion-delay-*` / `--motion-stagger` | stagger |
| `--url-screen-reveal-*` / `--url-screen-error-*` | split + field error aliases |
| `--url-screen-error-mesh-*` | палитра invalid (= ban) |
| `--auth-screen-*` | divider / providers / OTP hint / links |
| `--auth-code-*` | ячейки OTP / caret / `--auth-code-resend-cooldown` |
| `--shell-review-*` | квиз / report / done |
| `--home-screen-*` | topbar / feed / avatar / locked-modal |
| `--app-modal-*` | универсальная модалка (Figma Modal) |

Handoff без анимации visual: класс `.url-screen--handoff` + `brandScreenTransition.js`.

CSS: `animation-name: motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar`.  
JS: `src/utils/motionTokens.js`.  
Field errors: [`src/utils/FIELD_ERROR.md`](../src/utils/FIELD_ERROR.md).  
Visual variants: [`brand-screen-visual`](../src/components/brand-screen-visual/README.md).
