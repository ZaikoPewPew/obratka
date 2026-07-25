# `src/lib/dictation/` — голосовая надиктовка на `/review`

MVP: **Web Speech API** (браузер) → текст в памяти сессии → `answers.dictation` → секция листа.  
UI: чип **rec** в шапке iframe-shell (после reload), макет Figma `rec` (`470:1374`).

Аудио **не** грузим и **не** храним. Серверная транскрипция (Whisper) — следующий шаг за тем же контрактом.

## Контракт `DictationEngine`

| Метод | Смысл |
|-------|--------|
| `supported` | браузер умеет SpeechRecognition |
| `start()` → `Promise<boolean>` | mic + STT; `false` при deny / fail |
| `stop()` | остановить STT и треки |
| `onTranscript(cb)` | `(finalText, interim) => void` |
| `onLevel(cb)` | `0..1` для волны (AnalyserNode) |
| `onError(cb)` | `not_allowed` / `unsupported` / … |
| `destroy()` | teardown + clear listeners |

Фабрика: [`createDictationEngine.js`](createDictationEngine.js) → сейчас Web Speech; позже можно вернуть Whisper-реализацию **без** смены UI / поля отчёта.

Реализация A: [`createWebSpeechDictation.js`](createWebSpeechDictation.js)  
(`SpeechRecognition` / `webkitSpeechRecognition` + `getUserMedia` + `AnalyserNode`).

## Оркестрация (`main.js`)

1. На живом `/review` (claim + таймер) показать `.iframe-shell__rec`.
2. Toggle → `start` / `stop`; копить `dictationText` (cap `DICTATION_MAX_LEN`).
3. Конец таймера / уход / pagehide → `stop` (текст сохраняется до submit).
4. `submitPortfolioReview` → в `answers` добавить `dictation`, если непусто.
5. Новая сессия → `resetDictationSession()`.

Таймер просмотра: `REVIEW_SESSION_SECONDS = 45` в [`src/config/review.js`](../../config/review.js) — отдельно от claim TTL 20 min; ту же величину показывает intro-модалка home.

## Отчёт

- Поле: `answers.dictation?: string` (jsonb, SQL-миграция не нужна).
- Парсинг / PDF: [`src/utils/reviewReport.js`](../../utils/reviewReport.js) → секция `reportDictationTitle` после `advice`.
- Автор видит на `/report` и в PDF.

## UI / токены / i18n

| Что | Где |
|-----|-----|
| Разметка | `index.html` → `.iframe-shell__rec` |
| Стили | `styles/iframe-shell.css` (`.iframe-shell__rec*`) |
| Токены | `--control-rec-*`, `--color-recording` в `styles/tokens.css` |
| Строки | `reviewRec*`, `reportDictationTitle` в `content/locales.json` |

Кнопка скрыта, если Web Speech недоступен или route ≠ живой `/review`.

## Ограничения MVP

- Chrome / Edge — ок; Safari частично; Firefox обычно нет.
- В Chrome речь уходит в облако движка браузера (не наш сервер).
- Не обязательна; квиз и `advice` без изменений.

## Дальше (план B)

`MediaRecorder` → Edge Function → Whisper; тот же `DictationEngine`. Секрет API — только Function secrets ([`security.mdc`](../../../.cursor/rules/security.mdc)).

См. правило [`.cursor/rules/dictation.mdc`](../../../.cursor/rules/dictation.mdc), [`SCREENS.md`](../../../SCREENS.md).
