# `review-screen` — workspace квиза

Path: **`/quiz`**, финал **`/quiz/done`**. Split: слева слот под `review-panel`, справа brand visual (mesh + noise + лого + PDF-лист).

## API

`createReviewScreen({ content })` → `{ root, open, close, setReportReveal }`.

| Метод | Роль |
|-------|------|
| `open()` | Показать workspace (`.review-screen--open`) |
| `close()` | Убрать слой (motion close / reduced-motion) |
| `setReportReveal(active, payload?)` | Показать/скрыть PDF-лист; `payload.answers` → секции отчёта; `submitted: true` → улет листа + зелёный mesh (`.review-screen--done`) |

Монтаж: `main.js` передаёт `reviewPanel.root` как `content`.

## URL

- Открытие опроса → `syncRoute("quiz")` / `go("quiz")`.
- После submit → `syncRoute("done")` (`/quiz/done`), панель остаётся в том же workspace.

## Motion

Снизу вверх (`--shell-review-z-*`): glow → noise → report → brand.

На шаге advice лист выезжает (`getReportLaunchMotion`); после submit — уезд + `.review-screen--done` (`getReviewMeshDoneMotion`). Слева одновременно входит `review-panel__done`.

Токены `--shell-review-*`, `--motion-report-launch-*`. Классы в `iframe-shell.css`.  
PDF-тексты: `src/utils/reviewReport.js` (`buildReportSections`).

## i18n

`reviewPanelAria`, `reportDocumentTitle`, `brandName`, плюс ключи секций отчёта (`report*`).

См. [`review-panel/README.md`](../review-panel/README.md), [`SCREENS.md`](../../../SCREENS.md).
