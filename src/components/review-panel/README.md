# `review-panel` — квиз (опросник)

Левая колонка `review-screen`. Paths: **`/quiz`**, финал **`/quiz/done`**.

## Файл

- `ReviewPanel.js` — `createReviewPanel({ getPortfolioName?, onReportReveal?, onExit?, onNextCase?, onDoneChange? })`
  → `{ root, form, open, close, reset, focus, openDone }`.

## Шаги (8)

| # | Поле | UI |
|---|------|-----|
| 1 | `grade` | radio: junior → head |
| 2 | `context` | слайдер 1–5 |
| 3 | `structure` | radio |
| 4 | `metrics` | radio |
| 5 | `visual` | слайдер 1–10 |
| 6 | `pain` | checkbox + «Продолжить» |
| 7 | `hire` | radio |
| 8 | `advice` | textarea, min 100 / max 1000 |

Auto-advance на одиночных radio/слайдерах.

Шаг 8: `onReportReveal(true, …)` — PDF справа.  
Submit → done + `onDoneChange(true)` → URL `/quiz/done`.

## Финал (done)

«Готово, спасибо за обратку!» + **Выйти** / **Следующий кейс** → `onExit` / `onNextCase` → обычно `go("url")`.

`openDone()` — для deep link `/quiz/done`.

## i18n / стили

Ключи `review*`, `report*` в `locales.json`.  
`.review-panel*` + `--shell-review-*`.

Утилиты: `reviewReport.js`, `shareReviewPdf.js`.
