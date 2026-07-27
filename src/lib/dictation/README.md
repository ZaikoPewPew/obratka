# `src/lib/dictation/` — голосовая надиктовка

MVP: **Web Speech API** (браузер) → текст в памяти сессии.

Два места ввода, один движок:

| Где | UI | Куда падает текст |
|-----|----|-------------------|
| `/review` (живой таймер) | чип **rec** в шапке iframe-shell, Figma `rec` (`470:1374`) | `answers.dictation` → секция листа |
| `/quiz`, шаг «Главный совет» | кнопка микрофона в правом нижнем углу поля | прямо в `textarea#review-advice` (обычный `advice`) |

Аудио **не** грузим и **не** храним. Серверная транскрипция (Whisper) — следующий шаг за тем же контрактом.

## Контракт `DictationEngine`

| Метод | Смысл |
|-------|--------|
| `supported` | браузер умеет SpeechRecognition |
| `start()` → `Promise<boolean>` | mic + STT; `false` при deny / fail |
| `stop()` | остановить STT и треки |
| `resetTranscript()` | обнулить накопленный final-буфер |
| `setKeepAliveInBackground(bool)` | external-портфолио: не рвать сессию STT, пока вкладка скрыта |
| `resumeIfNeeded()` | добить restart после visibility / throttle |
| `onTranscript(cb)` | `(finalText, interim) => void` |
| `onLevel(cb)` | общий уровень `0..1` (AnalyserNode) |
| `onWaveform(cb)` | отдельный уровень `0..1` для каждой полосы волны |
| `onError(cb)` | `not_allowed` / `unsupported` / … |
| `destroy()` | teardown + clear listeners |

Фабрика: [`createDictationEngine.js`](createDictationEngine.js) → сейчас Web Speech; позже можно вернуть Whisper-реализацию **без** смены UI / поля отчёта.

Реализация A: [`createWebSpeechDictation.js`](createWebSpeechDictation.js)  
(`SpeechRecognition` / `webkitSpeechRecognition` + `getUserMedia` + `AnalyserNode`).

## Оркестрация (`main.js`)

1. Движок один на review-сессию; `dictationTarget` = `notes` (чип rec) или `advice` (поле квиза).
2. На живом `/review` (claim + таймер) показать `.iframe-shell__rec`; в квизе кнопку показывает `reviewPanel.setDictationSupported`.
3. Toggle → `start` / `stop`. Для `notes` копим `dictationText` (cap `DICTATION_MAX_LEN`); для `advice` перед стартом `resetTranscript()`, дальше текст уходит в `reviewPanel.setDictationTranscript` и дописывается к тому, что уже было в поле.
4. Конец таймера / уход / pagehide / submit → `stop`.
5. `submitPortfolioReview` → в `answers` добавить `dictation`, если непусто (`advice` идёт из формы как обычно).
6. Новая сессия → `resetDictationSession()`.

Таймер просмотра: `REVIEW_SESSION_SECONDS = 45` в [`src/config/review.js`](../../config/review.js) — отдельно от claim TTL 20 min; ту же величину показывает intro-модалка home.

Поведение при смене вкладки:

| Режим embed | Таймер | Надиктовка |
|-------------|--------|------------|
| iframe | пауза, пока вкладка скрыта | STT ждёт возврата (сессию не рвём) |
| external | wall-clock + `setTimeout` дедлайна — **не** паузится | `setKeepAliveInBackground(true)` — best-effort restart в фоне |

Конец таймера → звук [`Timer-end.wav`](../../assets/audio/Timer-end.wav) + стоп записи + quiz.

## Отчёт

- Поле: `answers.dictation?: string` (jsonb, SQL-миграция не нужна).
- Парсинг / PDF: [`src/utils/reviewReport.js`](../../utils/reviewReport.js) → секция `reportDictationTitle` после `advice`.
- Автор видит на `/report` и в PDF.

## UI / токены / i18n

| Что | Где |
|-----|-----|
| Разметка | `index.html` → `.iframe-shell__rec`; `ReviewPanel.js` → `.review-panel__rec` |
| Стили | `styles/iframe-shell.css` (`.iframe-shell__rec*`, `.review-panel__rec*`) |
| Токены | `--control-rec-*`, `--shell-review-rec-*`, `--color-recording` в `styles/tokens.css` |
| Мигание индикатора | `motion-recording-blink` в `styles/entrance.css` + `--motion-recording-blink-*` |
| Строки | `reviewRec*`, `reviewAdviceRec*`, `reportDictationTitle` в `content/locales.json` |

Обе кнопки скрыты, если Web Speech недоступен; чип rec — ещё и вне живого `/review`.  
Во время записи поле «Главный совет» readonly: транскрипт перезаписывает `value`, ручная правка разъехалась бы с буфером движка.

## Ограничения MVP

- Chrome / Edge — ок; Safari частично; Firefox обычно нет.
- В Chrome речь уходит в облако движка браузера (не наш сервер).
- Клиент просит до трёх гипотез, выбирает наиболее уверенную, отбрасывает низкоуверенные final-фрагменты и убирает повтор хвоста после авто-restart. На `stop` interim коммитится в final, чтобы текст не пропадал из поля. Это уменьшает явный мусор, но не меняет саму модель распознавания браузера.
- Фоновая вкладка: браузер может всё равно резать `SpeechRecognition`; для external делаем best-effort keep-alive, таймер при этом идёт по wall-clock.
- Надиктовка не обязательна: и заметки, и `advice` можно просто напечатать.

## Дальше (план B)

`MediaRecorder` → Edge Function → Whisper; тот же `DictationEngine`. Секрет API — только Function secrets ([`security.mdc`](../../../.cursor/rules/security.mdc)).

См. правило [`.cursor/rules/dictation.mdc`](../../../.cursor/rules/dictation.mdc), [`SCREENS.md`](../../../SCREENS.md).
