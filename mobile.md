# Мобильный UX — Обратка

**Политика v1:** продукт **desktop-only**.

| Viewport | Поведение |
|----------|-----------|
| **&lt; 768px** | Полный оверлей [`desktop-only-screen`](src/components/desktop-only-screen/README.md) — UI недоступен |
| **≥ 768px** | Обычный продукт (планшет = десктоп) |

Брейкпоинт: **768px** = `--breakpoint-min-desktop` в [`styles/tokens.css`](styles/tokens.css); JS — [`src/utils/viewport.js`](src/utils/viewport.js) (`DESKTOP_MIN_WIDTH_PX`, `isDesktopViewport`, `subscribeDesktopViewport`). В `@media` — литералы `768px` / `767px` (CSS variables в media queries не используем).

**Почему:** ревью портфолио в iframe / external на узком экране пока не поддерживается. Мобильный продукт — отдельная задача позже.

Карта экранов: [`SCREENS.md`](SCREENS.md). Аналитика: [`ANALYTICS.md`](ANALYTICS.md).

---

## Гейт (`desktop-only-screen`)

Не маршрут флоу и не path в `routes.js`. Монтаж и media-logic — в [`src/main.js`](src/main.js).

### Поведение

1. **Boot** и каждый `matchMedia` change → `syncDesktopOnlyGate(isDesktop)`.
2. Пока гейт активен:
   - `body.desktop-only-gated` (`overflow: hidden`);
   - оверлей с `z-index` выше toast (`--desktop-only-screen-z`);
   - `claimAndStartReview` сразу `return false`;
   - deep link `/review` / `/quiz` / `/quiz/done` → redirect на `/home` под оверлеем.
3. **Сужение окна mid-review** (живой claim / review / quiz / done) → `suspendReviewForDesktopOnlyGate`:
   - `review_aborted` с `reason: "desktop_only_gate"`;
   - `leaveSessionShell` + stop dictation + `releaseHeldClaim` (**без** монет);
   - `go("home")` под оверлеем.
4. **Ресайз ≥ 768** → `desktopOnlyScreen.close()` + `applyDocumentI18n()` (восстановление `document.title`).
5. Auth / OAuth / session под оверлеем могут жить — после расширения окна UI продолжается с текущей сессией.

### Копирайт (i18n)

| Ключ | RU | EN |
|------|----|----|
| `desktopOnlyTitle` | Пока только с компьютера | Desktop only for now |
| `desktopOnlyBody` | Ревью портфолио рассчитано на большой экран — открой Обратку с ноутбука или десктопа | Portfolio review is built for a large screen — open Obratka on a laptop or desktop |
| `metaTitleDesktopOnly` | Обратка — только с компьютера | Obratka — desktop only |

Источник: [`content/locales.json`](content/locales.json). Висячие предлоги — `fixHangingPrepositions` в фабрике экрана.

### Аналитика

| Event | Когда | Props |
|-------|--------|-------|
| `desktop_only_gate_shown` | первый показ гейта за загрузку страницы | — |
| `review_aborted` | silent abort из‑за сужения окна | `reason: "desktop_only_gate"`, `portfolio_id?`, `route_id?` |

### Код

| Файл | Роль |
|------|------|
| [`src/utils/viewport.js`](src/utils/viewport.js) | `768` + `matchMedia` |
| [`src/components/desktop-only-screen/`](src/components/desktop-only-screen/) | UI-оверлей |
| [`styles/desktop-only-screen.css`](styles/desktop-only-screen.css) | Стили |
| [`styles/tokens.css`](styles/tokens.css) | `--desktop-only-screen-*`, `--breakpoint-min-desktop` |
| [`src/main.js`](src/main.js) | `syncDesktopOnlyGate`, `suspendReviewForDesktopOnlyGate`, guards |

Отступы и размеры — только через токены (`.cursor/rules/design-tokens.mdc`).

---

## Чеклист QA (desktop-only)

| Сценарий | Ожидание |
|----------|----------|
| Телефон / DevTools &lt; 768 | Сразу оверлей; title = `metaTitleDesktopOnly` |
| Планшет / окно ≥ 768 | Обычный флоу (referral → … → home) |
| Ресайз 1200 → 375 | Оверлей; если был review — claim снят, без +10 |
| Ресайз 375 → 1200 | Оверлей закрыт; сессия и home на месте |
| Deep link `/review` на узком | Redirect home + оверлей (shell не поднимается) |
| Google/Telegram return на телефоне | Сессия может установиться; UI закрыт оверлеем |
| `?lang=en` на узком | EN-копирайт на заглушке |
| Ban + узкий экран | Оверлей выше ban (гейт закрывает весь продукт) |

---

## Подключённые стили (entry)

Из `index.html`: `tokens.css`, `base.css`, `entrance.css`, `brand-screen.css`, …  
`desktop-only-screen.css` подтягивается импортом из фабрики JS (как `ban-screen.css`).

---

## Архив: waitlist-макет (не продукт)

Ниже — историческая спека лендинга вейтлиста (таймер «В базе N», apply-card, dual layout). **Не** описывает текущий `main.js`. Код waitlist удалён; текст оставлен для сверки со старым Figma.

<details>
<summary>Старая спека (767px waitlist)</summary>

Целевой референс для узкого экрана waitlist (`max-width: 767px`). Отступы от краёв: **16px**.

Бывшая реализация: `styles/mobile.css` + классы `mobile-*` / `.layout-mobile` — удалены. Dual-tree `.layout-desktop` / `.layout-mobile` **не** восстанавливать без явной задачи.

Хедер waitlist: таймер слева, текст «В базе N», язык справа; pill `border-radius` ~500px; фон поверхности — через токены (`--color-surface-muted`), не хардкод `#f3f4f7` в новом коде.

Форма: email + CTA (бывшие `apply-card` / `email-field`).

При переносе идей из архива в продукт — сразу переводить значения в `styles/tokens.css`.

</details>

<details>
<summary>Архив: чеклист адаптивного продукта (до desktop-only гейта)</summary>

Раньше продуктовые экраны считались адаптивными через CSS (split brand, home, review-shell). Пока действует desktop-only гейт, этот чеклист **не** актуален для QA телефона — оставлен на случай снятия гейта.

| Экран / сценарий | Проверить |
|------------------|-----------|
| `/referral` | поле кода, validate RPC, ошибки exhausted/invalid, handoff на auth |
| `/registration` | email → `/registration/code` (OTP + cooldown); Telegram; Google |
| `/registration/code` | 6 ячеек; cooldown; ошибки identity / rate-limit |
| `/onboarding` | шаги, валидация, запись в `profiles` |
| `/home` | Чужие/Мои/Рейтинг, query, SWR, tabbar-dock, intro до claim, сегменты, free-slot, mine gate, feedSeen + 3/3, баланс / репутация |
| `/settings` | side-panel профиля; «На главную» |
| `/portfolio` | ввод URL, back-chip, баланс, done |
| `/review` | iframe / external, таймер 45 s, rec, abort |
| `/quiz` → done | шкалы, mic в совете, PDF reveal |
| `/report` | листы, жалоба (1 тег, окно 6ч), PDF |
| `/banned` | mesh, «Выйти» / «Связаться» |
| Язык / тема | `?lang=en`, `data-theme="dark"` |
| Safe area | notch / home indicator на iOS Safari |

</details>
