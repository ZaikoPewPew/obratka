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

На шаге advice лист выезжает (CSS `--report`); на короткой visual — clamp ≥ `--shell-review-report-gap-below-brand` под лого (`--shell-review-report-shift-shown-effective`); после submit — уезд (`getReportLaunchMotion`) + `.review-screen--done` (`getReviewMeshDoneMotion`). `setReportReveal(true)` / hide без `submitted` не прерывают уже запущенный submitted-launch (гонка с polish/`setAdviceText`). Марка: in-place morph `morphBrandMarkToDone` (нимб + fade короны), без `innerHTML`-swap. Слева одновременно входит `review-panel__done`.

Токены `--shell-review-*`, `--motion-report-launch-*`. Классы в `iframe-shell.css`.  
Launch стартует с `readSheetTranslateY` (вычисленный Y после clamp), не с сырых `22%`.  
PDF-тексты: `src/utils/reviewReport.js` (`buildReportSections` — preview без L2/L3; full на report/PDF; `dictation` → `reportDictationTitle`).  
Надиктовка / polish: [`lib/dictation/README.md`](../../lib/dictation/README.md), [`polish-dictation`](../../../supabase/functions/polish-dictation/README.md) (клиентский kill-switch сейчас off).
Шкалы в panel: [`scale-slider`](../scale-slider/README.md) (context/visual **1–5**).  
Пул и трактовки: [`QUIZ.md`](../../../QUIZ.md).

## i18n

`reviewPanelAria`, `reportDocumentTitle`, `brandName`, плюс ключи секций отчёта (`report*`, `reportDictationTitle`, `reportTier*`, `reportSummary*`).

См. [`QUIZ.md`](../../../QUIZ.md), [`review-panel/README.md`](../review-panel/README.md), [`scale-slider/README.md`](../scale-slider/README.md), [`lib/dictation/README.md`](../../lib/dictation/README.md), [`SCREENS.md`](../../../SCREENS.md).
