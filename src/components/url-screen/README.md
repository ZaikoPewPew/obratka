# `url-screen` — подача своего портфолио

Path: **`/portfolio`**. Ввод URL со своего Home (нужен баланс ≥ cost).

## Роль

**Эталон visual** для split-экранов: левая форма + правый mesh/бренд через [`brand-screen-shell`](../brand-screen-shell/README.md) (`withBrandSlot: true`).  
Referral / auth / auth-code / onboarding — тот же shell и классы `.url-screen*`.

См. [`SCREENS.md`](../../../SCREENS.md).

## Файл

- `UrlScreen.js` — `createUrlScreen({ onSubmit, onExit })` → `{ root, open, close }`.
- `open(prefill?, { handoff? })`, `close({ handoff? })` через shell → `brandScreenTransition.js`.
- Visual: shell `withBrandSlot: true` + preview-лист вставляется перед `brand`.

## Visual и состояния поля

| Состояние | Поле | Visual |
|-----------|------|--------|
| Обычное | — | `setVariant("default")` |
| Невалидный URL / ошибка | `setUrlScreenFieldInvalid` | `setVariant("invalid")` |
| После submit | форма → done copy | `setVariant("done")` (зелёный mesh + logo-angel) |

Ошибки: [`FIELD_ERROR.md`](../../utils/FIELD_ERROR.md). Variants: [`brand-screen-visual`](../brand-screen-visual/README.md).

## Поведение

1. Слева сверху формы — чип «На главную» (`review-panel__back` + `urlScreenBack`) → `onExit` → home; на done-состоянии скрыт.
2. Валидный URL (debounce) → справа белый лист: заголовок «Портфолио» + серые скелетоны строк (без скриншотов). На короткой visual лист clamp’ится ≥ `--shell-review-report-gap-below-brand` под поднятым лого (`--shell-review-report-shift-shown-effective`).
3. Очистка поля → лист улетает вниз.
4. Submit → сразу done-UI («Портфолио отправлено»); `onSubmit(url)` и persist идут в фоне. URL → `/done` через `syncRoute` (без скачка на success-screen). При ошибке сети → home.
5. Done CTA «На главную» → `onExit` → home.

## Motion

При `open()` без handoff: `.url-screen--open`, staggered reveal.  
Done: `getMotionReveal` leave/enter + `getReportLaunchMotion` для листа (как `review-panel` / `review-screen`).  
Марка: in-place morph через `BrandScreenVisual.setVariant("done")` — без `innerHTML`-swap, чтобы не переигрывать entrance.

## Стили

`.url-screen*` в `brand-screen.css`, токены `--url-screen-*` в `tokens.css`.  
Back-чип: `.url-screen__back` — позиция; `.review-panel__back*` — визуал чипа (тоже в `brand-screen.css`, cold path; как на auth-code / quiz).
