# `styles/` — слои стилей

- `tokens.css` — **источник дизайн-токенов** (примитивы → семантика → темы). Правило: `.cursor/rules/design-tokens.mdc`.
- `base.css` — сброс / база.
- `entrance.css` — `@keyframes motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar` / `motion-reveal-dock` / `motion-recording-blink` / `motion-reputation-eyes-look` (+ `-once`) / `motion-balance-duck-float` (+ `-once`) / `motion-control-error-buzz` (пульс индикатора записи + взгляд глазок репутации + покачивание уточки баланса + error-buzz).
- `app-modal.css` — универсальная модалка (`createAppModal`, `--app-modal-*`).
- `side-panel.css` — боковая панель (`createSidePanel`, `--side-panel-*`).
- `iframe-shell.css` — оболочка `/review` (таймер, **`.iframe-shell__rec`**, external viewer), `.url-screen*` (в т.ч. **`.url-screen__back`**, `__error*`, `__input-wrap--invalid`), `.auth-screen*` / `.auth-code-screen*` (в т.ч. `__cells--invalid`), `.review-screen*` / `.review-panel*` (в т.ч. **`.review-panel__rec`**, **`.review-panel__scale-*` / `__slider-*`** — шкалы [`scale-slider`](../src/components/scale-slider/README.md)). Таймер: iframe pause / external wall-clock; звук конца — `src/assets/audio/Timer-end.wav`.
- `brand-screen.css` — split brand-экраны из `index.html` (cold path); в т.ч. общий чип `.review-panel__back*` для url / auth-code; onboarding video CTA (`.onboarding-screen__video-cta*`).
- `video-player-card.css` — side-effect import из [`VideoPlayerCard`](../src/components/video-player-card/README.md); токены `--video-player-*`.
- `home-screen.css` — главная `/home` (topbar, лента, вкладка рейтинга `.home-screen__rating-list` / плашка `.home-screen__rating-reputation`, tabbar-dock: glass tabs + submit + tab-dot, `--on-dark`).
- `legendary-online-panel.css` — fixed-чип «Топы в сети» слева снизу на home.
- `feedback.css` — fixed FAB feedback (Telegram) на home; Lottie-кепка (`--feedback-lottie-nudge-y`).
- `notification.css` — toast Notification (top-right под аватаром home).
- `tabs-panel.css` — сегмент feed/mine на home (`createTabsPanel`, `--tabs-panel-*`).
- `success-screen.css` — `/done` (пресеты успеха).
- `ban-screen.css` — `/banned` (блок аккаунта, красный mesh).
- `report-screen.css` — `/report` (листы + жалоба).
- `desktop-only-screen.css` — оверлей &lt;768px; импорт из фабрики JS (как `ban-screen.css`). Токены `--desktop-only-screen-*`.
- `account-menu.css` / `settings-screen.css` — меню профиля / settings (view-only профиль, select-шеврон специальности).
- `rating-panel.css` — **не в entry**; оболочка неиспользуемого aside `src/components/rating/`.
- `landing/styles/landing.css` — промо MPA; токены `--landing-*` в `tokens.css`.

## Что подключено из `index.html`

`tokens.css` → `base.css` → `entrance.css` → `app-modal.css` → `side-panel.css` → `iframe-shell.css` → `success-screen.css` → `report-screen.css` → `ban-screen.css` → `home-screen.css` → `legendary-online-panel.css` → `feedback.css` → `notification.css` → `tabs-panel.css` → `account-menu.css` → `settings-screen.css`.

`desktop-only-screen.css` — side-effect import из `desktop-only-screen/`. Лендос — свой HTML entry (`landing/index.html`).

Архив waitlist-CSS удалён (`desktop` / `mobile` / `apply` / `access-modal` / `notification` / `privacy-policy-panel`). Политика v1: [`mobile.md`](../mobile.md) (desktop-only гейт).

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
| `--motion-reputation-eyes-*` | периодический взгляд глазок чипа репутации |
| `--motion-balance-duck-*` | периодическое покачивание уточки на чипе баланса |
| `--motion-control-error-buzz-*` | короткий горизонтальный buzz (хаптик ошибки) |
| `--motion-delay-*` / `--motion-stagger` | stagger |
| `--url-screen-reveal-*` / `--url-screen-error-*` | split + field error aliases |
| `--url-screen-error-mesh-*` | палитра invalid (= ban) |
| `--auth-screen-*` | divider / providers / OTP hint / links |
| `--auth-code-*` | ячейки OTP / caret / `--auth-code-resend-cooldown` |
| `--shell-review-*` | квиз / report / done (в т.ч. `--shell-review-done-btn-padding-x`, `--shell-review-done-loader-*`) |
| `--home-screen-card-reviewed-*` | превью-статус «Отчёт отправлен» на «Уже отревьюено»: заливка (`-bg`), gap, галочка (`report-sent.svg` + `--color-success`), текст; карточка без hover/click |
| `--shell-review-slider-*` | шкалы context/visual (readout / hint / track / canvas / thumb / stops / title motion) |
| `--control-rec-*` / `--color-recording` | чип надиктовки в шапке `/review` |
| `--shell-review-rec-*` | кнопка надиктовки в поле «Главный совет» |
| `--home-screen-*` | topbar / feed / avatar / locked-modal |
| `--home-screen-review-intro-*` | видео-слот intro-модалки (max 552, aspect 1256/720) |
| `--home-screen-tabbar-*` | glass track (gray-900 10% / white on-dark 20% / blur 20), hide/thumb/label/contrast; dock-gap + submit (56×56 Google blue) + tab-dot (6px Google red) |
| `--home-screen-reveal-delay-*` | entrance stagger на `/home` (topbar → body → dock → fab); dock = `motion-reveal-dock` **без** opacity (glass `backdrop-filter`) |
| `--tabs-panel-*` | сегмент feed/mine (track / tab / thumb / tab-dot) |
| `--app-modal-*` | универсальная модалка (Figma Modal) |
| `--desktop-only-screen-*` | оверлей &lt;768px (z / padding / card / brand) |
| `--landing-*` | промо MPA (`landing/styles/landing.css`) |
| `--breakpoint-min-desktop` | 768px (документация; в `@media` — литералы) |

Handoff без анимации visual: класс `.url-screen--handoff` + `brandScreenTransition.js`.

CSS: `animation-name: motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar` / `motion-reveal-dock`; idle `motion-balance-duck-float` / `motion-reputation-eyes-look`; отказ — класс `.motion-control-error-buzz`.  
`motion-reveal-dock` — slide-up с `translateX(-50%)`, без opacity (иначе у `.home-screen__tabbar` пропадает blur).  
JS: `src/utils/motionTokens.js`.  
Field errors: [`src/utils/FIELD_ERROR.md`](../src/utils/FIELD_ERROR.md).  
Visual variants: [`brand-screen-visual`](../src/components/brand-screen-visual/README.md).
