# `review-screen` — полноэкранный опрос после сессии

Split-экран как у `url-screen`: слева опросник (`review-panel`), справа brand visual (mesh + noise + лого).

## Файл

- `ReviewScreen.js` — `createReviewScreen({ content })` → `{ root, open, close, setReportReveal }`.

## API

| Метод | Назначение |
|--------|------------|
| `open()` | Показать экран, запустить mesh, сбросить reveal отчёта |
| `close()` | Закрытие с transition (как url-screen) |
| `setReportReveal(active, payload?)` | Финальный шаг: PDF-лист выезжает, лого уезжает вверх. `payload.answers` + `portfolioName` заполняют лист теми же секциями, что и печатный PDF (`buildReportSections`) |

Монтаж: `main.js` кладёт `reviewPanel.root` в `content`, `onDoneChange` → `setReportReveal`.

## Visual (слои)

Снизу вверх (`--shell-review-z-*`):

1. `glow` — mesh wash  
2. `noise` — зерно  
3. `report` — лист отчёта (скрыт до финала)  
4. `brand` — логотип  

Лист: eyebrow (бренд) → заголовок → имя портфолио → секции трактовок (грейд, ясность, структура, метрики, визуал, вердикт, совет).  
Фон: `--shell-review-report-bg` → `--color-surface-muted` (`#F3F4F7`).

## Motion финала

Класс `.review-screen--report`:

- лист: `translateY` из-за нижней кромки фрейма (`--shell-review-report-shift-*`, duration ~1600ms);
- лого: из центра к `--shell-review-brand-top` (40px).

`prefers-reduced-motion` — почти мгновенно.

## Стили / токены

- Классы: `.review-screen*` в `styles/iframe-shell.css`
- Токены: `--shell-review-*`, `--url-screen-*` (padding, radius, noise, brand size)

См. также [`review-panel/README.md`](../review-panel/README.md), [`SCREENS.md`](../../../SCREENS.md).
