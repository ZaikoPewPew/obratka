# `url-screen` — подача своего портфолио

Path: **`/portfolio`**. Ввод URL со своего Home (нужен баланс ≥ cost).

## Роль

**Эталон visual** для split-экранов: левая форма + правый mesh/бренд.  
Referral / auth / onboarding опираются на `.url-screen*`; цель — общий `brand-screen-shell`.

См. [`SCREENS.md`](../../../SCREENS.md).

## Файл

- `UrlScreen.js` — `createUrlScreen({ onSubmit, onExit })` → `{ root, open, close }`.
- `open(prefill?, { handoff? })`, `close({ handoff? })` через `brandScreenTransition.js`.

## Поведение

1. Валидный URL (debounce) → справа белый лист: заголовок «Портфолио» + серые скелетоны строк (без скриншотов).
2. Очистка поля → лист улетает вниз.
3. Submit → сразу done-UI («Портфолио отправлено»); `onSubmit(url)` и persist идут в фоне. URL → `/done` через `syncRoute` (без скачка на success-screen). При ошибке сети → home.
4. «Выйти» → `onExit` → home.

## Motion

При `open()` без handoff: `.url-screen--open`, staggered reveal.  
Done: `getMotionReveal` leave/enter + `getReportLaunchMotion` для листа (как `review-panel` / `review-screen`).  
Марка: in-place morph `mark → logo-done` (`morphBrandMarkToDone`) вместе с зелёным mesh — без `innerHTML`-swap, чтобы не переигрывать entrance.

## Стили

`.url-screen*` в `iframe-shell.css`, токены `--url-screen-*` в `tokens.css`.
