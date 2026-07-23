# `review-panel` — шаги квиза

Левая панель опроса после таймера ревью. После submit последнего шага — **локальный done** (заголовок + «Выйти» / «Следующий кейс»), справа улетает PDF-лист.

## API

- `ReviewPanel.js` — `createReviewPanel({ getPortfolioName?, onReportReveal?, onComplete?, onDoneChange?, onExit?, onNextCase? })`
  → `{ root, form, open, close, reset, focus, openDone }`.

## Флоу

1. Шаг advice → `onReportReveal(true)` (лист справа).
2. Submit → `onComplete(answers)` (награда) + `showDone` + `onReportReveal(false, { submitted: true })` (улет листа) + `onDoneChange(true)` → URL `/quiz/done`.
3. CTA → `onExit` / `onNextCase` → обычно `go("home")`.

См. [`review-screen/README.md`](../review-screen/README.md), [`SCREENS.md`](../../../SCREENS.md).
