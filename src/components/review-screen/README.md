# `review-screen` — workspace квиза

Path: **`/quiz`**, финал **`/quiz/done`**. Split: слева `review-panel`, справа brand visual (mesh + noise + лого + PDF-лист).

## API

`createReviewScreen({ content })` → `{ root, open, close, setReportReveal, … }`.

## URL

- Открытие опроса → `syncRoute("quiz")` / `go("quiz")`.
- После submit → `syncRoute("done")` (`/quiz/done`), панель остаётся в том же workspace.

## Motion

Снизу вверх (`--shell-review-z-*`): glow → noise → report → brand.

На шаге advice лист выезжает; после submit — уезд + `.review-screen--done` (зелёный mesh). Слева одновременно входит `review-panel__done`.

Токены `--shell-review-*`, `--motion-report-launch-*`. Классы в `iframe-shell.css`.
