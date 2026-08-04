# `src/lib/dictation/` — голосовая надиктовка

MVP: **Web Speech API** (браузер) → текст в памяти сессии.

Два места ввода, один движок:

| Где | UI | Куда падает текст |
|-----|----|-------------------|
| `/review` (живой таймер) | чип **rec** в шапке iframe-shell, Figma `rec` (`470:1374`) | `answers.dictation` → секция листа |
| `/quiz`, шаг «Главный совет» | кнопка микрофона в правом нижнем углу поля | прямо в `textarea#review-advice` (обычный `advice`) |

Аудио **не** грузим и **не** храним. Серверная транскрипция (Whisper) — следующий шаг за тем же контрактом.

## Post-edit (пунктуация)

После stop / перед submit сырой текст **может** пройти post-edit через Edge [`polish-dictation`](../../../supabase/functions/polish-dictation/README.md) + [`dictationPolish.js`](../../api/dictationPolish.js).

**Сейчас выключен:** `POLISH_ENABLED = false` в `dictationPolish.js` — без invoke, сразу сырой текст. Function и проводка в `main.js` на месте; вернуть → `true`. SoT статуса: [`polish-dictation/README.md`](../../../supabase/functions/polish-dictation/README.md) § «Статус».

| | |
|--|--|
| Что делает | пунктуация, пробелы, регистр (Z.AI Flash LLM) |
| Что **не** делает | STT, смена смысла, перевод, саммари, «улучшение» ревью |
| Модель | `glm-4.5-flash` (Free); запасная `glm-4.7-flash` |
| Секреты | `ZAI_API_KEY` (+ опц. `ZAI_MODEL`, `ZAI_MODEL_FALLBACK`) только в Function secrets |
| Soft-fail | любая ошибка / все модели упали / таймаут / нет ключа → **сырой текст как есть**; submit **не** блокируется |
| Kill-switch | `POLISH_ENABLED` в `dictationPolish.js` (сейчас `false`) |

### Soft-fail (двойной)

1. **Edge:** цепочка моделей (primary → fallback) с ретраями на `1305`/429/5xx. Если все попытки исчерпаны → HTTP 200 `{ text: <исходный>, skipped: true, error: "zai_1305" | … }`.
2. **Клиент:** `polishDictationText` при invoke-error, таймауте (~14 s), пустом `text` или network → возвращает исходную строку. Abort / pagehide polish **не** ждут. При `POLISH_ENABLED === false` сеть не трогаем.

Итог при включённом polish: поле совета, `answers.dictation` и PDF всегда получают хоть какой-то текст юзера — отполированный или сырой Web Speech. При выключенном — всегда сырой.

### Когда в `main.js`

| Событие | `stopDictation({ polish })` / вызов |
|---------|--------------------------------------|
| Toggle stop (notes / advice) | `polish: true` → notes в `dictationText`, advice через `setAdviceText` |
| Конец таймера → quiz (`openReview`) | `polish: true` на notes (async) |
| Submit квиза (`onComplete`) | `polishDictationText` на `dictation` + `advice` (ждёт «На главную» / next case) |
| Abort / pagehide / reset | stop **без** polish |

Клиент: `polishDictationText(text, { maxLen, locale })` — при `POLISH_ENABLED` → `functions.invoke("polish-dictation")`, timeout ~14 s; иначе no-op. SoT Function: [`polish-dictation/README.md`](../../../supabase/functions/polish-dictation/README.md).

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
3. Toggle → `start` / `stop` (`stopDictation({ polish: true })` на ручном stop). Для `notes` копим `dictationText` (cap `DICTATION_MAX_LEN`); для `advice` перед стартом `resetTranscript()`, дальше текст уходит в `reviewPanel.setDictationTranscript` и дописывается к тому, что уже было в поле.
4. Конец таймера / уход / pagehide → `stop` (polish только на таймере→quiz и ручном stop; abort/pagehide — без).
5. Перед `submitPortfolioReview` — ещё раз polish `dictation` + `advice`, затем мерж `dictation` в payload.
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

Post-edit текста: код на проде, **клиентский kill-switch выключен** (`POLISH_ENABLED = false`); подробности — [`supabase/functions/polish-dictation/README.md`](../../../supabase/functions/polish-dictation/README.md) § «Статус».

См. правило [`.cursor/rules/dictation.mdc`](../../../.cursor/rules/dictation.mdc), [`SCREENS.md`](../../../SCREENS.md).
