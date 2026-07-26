# `styles/` — слои стилей

- `tokens.css` — **источник дизайн-токенов** (примитивы → семантика → темы). Правило: `.cursor/rules/design-tokens.mdc`.
- `base.css` — сброс / база.
- `entrance.css` — `@keyframes motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar` / `motion-recording-blink` (пульс индикатора записи).
- `app-modal.css` — универсальная модалка (`createAppModal`, `--app-modal-*`).
- `iframe-shell.css` — оболочка `/review` (таймер, **`.iframe-shell__rec`**), `.url-screen*` (в т.ч. **`.url-screen__back`**, `__error*`, `__input-wrap--invalid`), `.auth-screen*` / `.auth-code-screen*` (в т.ч. `__cells--invalid`), `.review-screen*` / `.review-panel*` (в т.ч. **`.review-panel__rec`**).
- `brand-screen.css` — **заготовка** выноса общих split-стилей из iframe-shell.
- `home-screen.css` — главная `/home` (topbar, лента, tabbar-dock: glass tabs + submit + tab-dot 3/3, `--on-dark`).
- `tabs-panel.css` — сегмент Активные / Завершенные на «Мои» (`createTabsPanel`, `--tabs-panel-*`).
- `success-screen.css` — `/done` (пресеты успеха).
- `ban-screen.css` — `/banned` (блок аккаунта, красный mesh).
- `report-screen.css` — `/report` (листы + жалоба).
- `account-menu.css` / `settings-screen.css` — меню профиля / settings.

## Что подключено из `index.html`

`tokens.css` → `base.css` → `entrance.css` → `app-modal.css` → `iframe-shell.css` → `success-screen.css` → `report-screen.css` → `ban-screen.css` → `home-screen.css` → `tabs-panel.css` → `account-menu.css` → `settings-screen.css`.

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
| `--motion-recording-blink-*` | пульс красного индикатора записи |
| `--motion-delay-*` / `--motion-stagger` | stagger |
| `--url-screen-reveal-*` / `--url-screen-error-*` | split + field error aliases |
| `--url-screen-error-mesh-*` | палитра invalid (= ban) |
| `--auth-screen-*` | divider / providers / OTP hint / links |
| `--auth-code-*` | ячейки OTP / caret / `--auth-code-resend-cooldown` |
| `--shell-review-*` | квиз / report / done |
| `--control-rec-*` / `--color-recording` | чип надиктовки в шапке `/review` |
| `--shell-review-rec-*` | кнопка надиктовки в поле «Главный совет» |
| `--home-screen-*` | topbar / feed / avatar / locked-modal |
| `--home-screen-review-intro-*` | шаги intro-модалки (`indent` / `step-gap`) |
| `--home-screen-tabbar-*` | glass track (gray-900 10% / white on-dark 20% / blur 20), hide/thumb/label/contrast; dock-gap + submit (56×56 Google blue) + tab-dot (6px Google red) |
| `--tabs-panel-*` | сегмент Активные/Завершенные (track / tab / thumb / tab-dot) |
| `--app-modal-*` | универсальная модалка (Figma Modal) |

Handoff без анимации visual: класс `.url-screen--handoff` + `brandScreenTransition.js`.

CSS: `animation-name: motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar`.  
JS: `src/utils/motionTokens.js`.  
Field errors: [`src/utils/FIELD_ERROR.md`](../src/utils/FIELD_ERROR.md).  
Visual variants: [`brand-screen-visual`](../src/components/brand-screen-visual/README.md).
