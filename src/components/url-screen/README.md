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
| После submit | форма → done copy | `setVariant("done")` (зелёный mesh + logo-done) |

Ошибки: [`FIELD_ERROR.md`](../../utils/FIELD_ERROR.md). Variants: [`brand-screen-visual`](../brand-screen-visual/README.md).

## Поведение

1. Валидный URL (debounce) → справа белый лист: заголовок «Портфолио» + серые скелетоны строк (без скриншотов).
2. Очистка поля → лист улетает вниз.
3. Submit → сразу done-UI («Портфолио отправлено»); `onSubmit(url)` и persist идут в фоне. URL → `/done` через `syncRoute` (без скачка на success-screen). При ошибке сети → home.
4. «На главную» → `onExit` → home.

## Motion

При `open()` без handoff: `.url-screen--open`, staggered reveal.  
Done: `getMotionReveal` leave/enter + `getReportLaunchMotion` для листа (как `review-panel` / `review-screen`).  
Марка: in-place morph через `BrandScreenVisual.setVariant("done")` — без `innerHTML`-swap, чтобы не переигрывать entrance.

## Стили

`.url-screen*` в `iframe-shell.css`, токены `--url-screen-*` в `tokens.css`.
