# `review-panel` — шаги квиза

Левая панель опроса после таймера ревью (`/review` → `/quiz`). После submit последнего шага — **локальный done** (заголовок + «На главную» / «Следующий кейс»), справа улетает PDF-лист.

**Полная спека пула вопросов, схемы `answers`, L1/L2/L3 отчёта:** [`QUIZ.md`](../../../QUIZ.md).

Надиктовка с `/review` **не** в panel: `main.js` мержит `answers.dictation` в `onComplete` перед `submitPortfolioReview` (после polish, если `POLISH_ENABLED`). См. [`lib/dictation/README.md`](../../lib/dictation/README.md), [`dictationPolish.js`](../../api/dictationPolish.js).

## API

`createReviewPanel({ getPortfolioName?, onReportReveal?, onComplete?, onDoneChange?, onExit?, onNextCase?, onDictationToggle? })`
→ `{ root, form, open, close, reset, focus, openDone, setDictationSupported, setDictationRecording, setDictationTranscript, setAdviceText, setNextCaseBusy, setNextCasePreparing, setNextCaseEmpty, setNextCaseVisible, setExitBusy }`.

## Шаги

| # | Тип | Поле | UI |
|---|-----|------|-----|
| 1 | single | `grade` | radio: `junior` · `mid` · `senior` · `staff` · `lead` · `head` |
| 2 | scale | `context` 1–5 | [`scale-slider`](../scale-slider/README.md) — понятность бизнес-задачи |
| 3 | single | `structure` | radio: `mess` · `dump` · `outline` · `clear` |
| 4 | single | `metrics` | radio: `none` · `vanity` · `nominal` · `solid` · `strong` |
| 5 | scale | `visual` 1–5 | [`scale-slider`](../scale-slider/README.md) — визуал |
| 5a | multi | `pain` | checkbox: `composition` · `contrast` · `components` · `overloaded`; **только если `visual ≤ 2`** |
| 6 | single | `tier` | radio: `early` · `mid` · `strong` · `top` (рыночный уровень; **не** `profiles.tier`) |
| 7 | advice | `advice` | textarea + микрофон; min 100 / max 1000 |

### Условный pain

- Шаг в массиве с `isVisible: () => visual ≤ 2`.
- `goNext` / `goBack` / progress пропускают скрытый шаг (`findAdjacentVisibleStep` / `visibleStepIndices`).
- При уходе с visual при `value ≥ 3` — `clearPainSelections()`.
- Варианта «всё ок» нет (раньше был `ok` + exclusive-логика — удалены).

Progress считает только **видимые** шаги (6 или 7 в зависимости от visual).

Шкалы: idle-заголовок (`reviewContextShort` / `reviewVisualShort`) + **сразу** приписка полного вопроса (`description`); после касания заголовок → `Value*`, приписка → `Hint*` ступени (без появления с нуля). Вопросный `.review-panel__question` на scale-шагах скрыт.

Авто-advance на single/scale после выбора (кроме pain и advice).

## Надиктовка в шаге advice

В поле «Главный совет» — кнопка `.review-panel__rec` (правый нижний угол). Panel только рисует состояние и складывает текст, STT живёт в `main.js`:

- клик → `onDictationToggle()` наверх;
- `setDictationSupported(bool)` — показать / скрыть кнопку (Web Speech);
- `setDictationRecording(bool)` — мигающий красный индикатор вместо микрофона; на переходе `false → true` запоминает текущий текст поля как базу;
- `setDictationTranscript(text)` — база + транскрипт в `textarea` (cap 1000), счётчик и reveal листа обновляются как при ручном вводе.
- `setAdviceText(text)` — абсолютная запись в поле совета (после polish Edge, если включён; без живой записи).

Во время записи поле readonly, `reset()` гасит состояние надиктовки.

## Флоу

1. Шаги single / multi / scale / advice (контент из локалей `review*`).
2. Шаг advice → `onReportReveal(true)` (лист справа на `review-screen`, `mode: "preview"`).
3. Submit → `answersFromFormData` → `onComplete(answers)` (награда; снаружи могут добавить `dictation`) + `showDone` + `onReportReveal(false, { submitted: true })` + `onDoneChange(true)` → URL `/quiz/done`.
4. CTA → `onExit` → home (`setExitBusy`: лоадер на «На главную», пока `reviewSubmitPromise` / release; при `POLISH_ENABLED` туда входит и polish LLM); `onNextCase` → claim следующего (лента + embed прогреваются на done через `prewarmNextReviewCase` в `main.js`). На done кнопка «Следующий кейс» сразу с лоадером (`setNextCasePreparing`); нет кандидатов — disabled + `reviewDoneNextCaseEmpty` (`setNextCaseEmpty`). Клик по next — `setNextCaseBusy` (лоадер + блок обеих CTA). Оркестрация в `main.js`.

Смена шага: leave/enter пачки `stage` + footer на `--motion-reveal-*` (`getMotionReveal`).  
Переход в done: form/top уходят, затем enter `review-panel__done`.

`reset()` / `clearAllSelections`: слайдеры получают `reset-visual` (idle-заголовок, min, `touched=0`).

## Стили / i18n

Классы `.review-panel__*` в `iframe-shell.css`; токены `--shell-review-*` / `--shell-review-rec-*` / `--shell-review-slider-*` / `--shell-review-done-loader-*`.  
CTA на done — hug по контенту (`--shell-review-done-btn-padding-x`), не растягиваются на всю ширину.  
Шкалы: [`scale-slider`](../scale-slider/README.md).  
Ключи: `review*`, `reviewDone*` (`reviewDoneNextCaseBusy`, `reviewDoneNextCaseEmpty`, `reviewDoneExitBusy`), `reviewContinue`, `reviewAdviceRec*`, `reviewTier*`, `reviewPain*`, `reviewContextShort` / `Value*` / `Hint*`, `reviewVisualShort` / `Value*` / `Hint*` (1–5).  
Мигание индикатора записи: `motion-recording-blink` в `styles/entrance.css`.

См. [`QUIZ.md`](../../../QUIZ.md), [`review-screen/README.md`](../review-screen/README.md), [`lib/dictation/README.md`](../../lib/dictation/README.md), [`SCREENS.md`](../../../SCREENS.md).
