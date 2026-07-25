# `review-panel` — шаги квиза

Левая панель опроса после таймера ревью (`/review` → `/quiz`). После submit последнего шага — **локальный done** (заголовок + «Выйти» / «Следующий кейс»), справа улетает PDF-лист.

Надиктовка с `/review` **не** в panel: `main.js` мержит `answers.dictation` в `onComplete` перед `submitPortfolioReview`. См. [`lib/dictation/README.md`](../../lib/dictation/README.md).

## API

`createReviewPanel({ getPortfolioName?, onReportReveal?, onComplete?, onDoneChange?, onExit?, onNextCase?, onDictationToggle? })`  
→ `{ root, form, open, close, reset, focus, openDone, setDictationSupported, setDictationRecording, setDictationTranscript }`.

## Надиктовка в шаге advice

В поле «Главный совет» — кнопка `.review-panel__rec` (правый нижний угол). Panel только рисует состояние и складывает текст, STT живёт в `main.js`:

- клик → `onDictationToggle()` наверх;
- `setDictationSupported(bool)` — показать / скрыть кнопку (Web Speech);
- `setDictationRecording(bool)` — мигающий красный индикатор вместо микрофона; на переходе `false → true` запоминает текущий текст поля как базу;
- `setDictationTranscript(text)` — база + транскрипт в `textarea` (cap 1000), счётчик и reveal листа обновляются как при ручном вводе.

Во время записи поле readonly, `reset()` гасит состояние надиктовки.

## Флоу

1. Шаги single / multi / scale / advice (контент из `content` / локалей `review*`).
2. Шаг advice → `onReportReveal(true)` (лист справа на `review-screen`).
3. Submit → `onComplete(answers)` (награда; снаружи могут добавить `dictation`) + `showDone` + `onReportReveal(false, { submitted: true })` + `onDoneChange(true)` → URL `/quiz/done`.
4. CTA → `onExit` / `onNextCase` → обычно `go("home")`.

Смена шага: leave/enter пачки `stage` + footer на `--motion-reveal-*` (`getMotionReveal`).  
Переход в done: form/top уходят, затем enter `review-panel__done`.

## Стили / i18n

Классы `.review-panel__*` в `iframe-shell.css`; токены `--shell-review-*` / `--shell-review-rec-*`.  
Ключи: `review*`, `reviewDone*`, `reviewContinue`, `reviewAdviceRec*`, шкалы и варианты.  
Мигание индикатора записи: `motion-recording-blink` в `styles/entrance.css`.

См. [`review-screen/README.md`](../review-screen/README.md), [`lib/dictation/README.md`](../../lib/dictation/README.md), [`SCREENS.md`](../../../SCREENS.md).
