# `review-panel` — шаги квиза

Левая панель опроса после таймера ревью (`/review` → `/quiz`). После submit последнего шага — **локальный done** (заголовок + «Выйти» / «Следующий кейс»), справа улетает PDF-лист.

## API

`createReviewPanel({ getPortfolioName?, onReportReveal?, onComplete?, onDoneChange?, onExit?, onNextCase? })`  
→ `{ root, form, open, close, reset, focus, openDone }`.

## Флоу

1. Шаги single / multi / scale / advice (контент из `content` / локалей `review*`).
2. Шаг advice → `onReportReveal(true)` (лист справа на `review-screen`).
3. Submit → `onComplete(answers)` (награда) + `showDone` + `onReportReveal(false, { submitted: true })` + `onDoneChange(true)` → URL `/quiz/done`.
4. CTA → `onExit` / `onNextCase` → обычно `go("home")`.

Смена шага: leave/enter пачки `stage` + footer на `--motion-reveal-*` (`getMotionReveal`).  
Переход в done: form/top уходят, затем enter `review-panel__done`.

## Стили / i18n

Классы `.review-panel__*` в `iframe-shell.css`; токены `--shell-review-*`.  
Ключи: `review*`, `reviewDone*`, `reviewContinue`, шкалы и варианты.

См. [`review-screen/README.md`](../review-screen/README.md), [`SCREENS.md`](../../../SCREENS.md).
