# `review-panel` — шаги квиза

Левая панель опроса после таймера ревью. Финал квиза — **не** здесь: `onComplete` → `success-screen` (`/done`, preset `quizComplete`).

## API

- `ReviewPanel.js` — `createReviewPanel({ getPortfolioName?, onReportReveal?, onComplete? })`
  → `{ root, form, open, close, reset, focus }`.

## Флоу

Submit последнего шага → `onComplete(answers)` → в `main.js`: `awardReviewReward()` + `go("done")`.

На последнем шаге (advice) по-прежнему `onReportReveal` для PDF-листа справа.

См. [`review-screen/README.md`](../review-screen/README.md), [`success-screen/README.md`](../success-screen/README.md), [`SCREENS.md`](../../../SCREENS.md).
