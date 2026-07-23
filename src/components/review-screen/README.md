# `review-screen` — оболочка квиза

Paths: **`/quiz`** (опрос), **`/quiz/done`** (финал).  
Не путать с **`/review`** — там iframe + таймер (просмотр портфолио).

Split как у `url-screen`: слева `review-panel`, справа brand visual (mesh + noise + лого + PDF-лист).

## Файл

- `ReviewScreen.js` — `createReviewScreen({ content })` → `{ root, open, close, setReportReveal }`.

## API

| Метод | Назначение |
|--------|------------|
| `open()` | Показать экран, mesh, сброс reveal |
| `close()` | Закрытие с transition |
| `setReportReveal(active, payload?)` | PDF-лист; `payload.answers` + `portfolioName` → `buildReportSections` |

Монтаж: `main.js` кладёт `reviewPanel.root` в `content`; `onReportReveal` → `setReportReveal`.  
URL: `syncRoute("quiz")` при открытии опроса, `syncRoute("done")` при done.

## Visual (слои)

Снизу вверх (`--shell-review-z-*`): glow → noise → report → brand.

На шаге advice лист выезжает; после submit — уезд + `.review-screen--done` (зелёный mesh).

## Motion / стили

Токены `--shell-review-*`, `--motion-report-launch-*`. Классы в `iframe-shell.css`.  
Подробности reveal — ниже по файлу в коде / см. историю в git.

См. [`review-panel/README.md`](../review-panel/README.md), [`SCREENS.md`](../../../SCREENS.md).
