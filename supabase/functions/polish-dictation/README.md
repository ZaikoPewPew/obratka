# Edge Function: `polish-dictation`

Post-edit сырого Web Speech транскрипта: пунктуация, пробелы, регистр.  
**Не** STT и **не** Whisper: аудио не принимаем, смысл текста не меняем, не переписываем как совет и не переводим.

| | |
|--|--|
| Клиент API | [`src/api/dictationPolish.js`](../../../src/api/dictationPolish.js) |
| Оркестрация | `main.js` — после stop rec (`polish: true`) и перед `submitPortfolioReview` |
| Движок STT | [`src/lib/dictation/`](../../../src/lib/dictation/README.md) (отдельно) |
| `verify_jwt` | `true` ([`config.toml`](../../config.toml)) |
| Upstream | `https://api.z.ai/api/paas/v4/chat/completions` |

## Зачем

Web Speech часто отдаёт кашу без точек. Flash правит уже готовый текст перед показом в поле совета / сохранением в `answers.dictation` / `advice`.

**Soft-fail обязателен:** если все модели не ответили, upstream упал, нет ключа или клиентский таймаут — в UI и в submit уходит **исходный** (сырой) текст. Пользователь этого не замечает как ошибку: submit / переход на quiz не блокируются.

## Soft-fail (двойной)

| Слой | Что происходит при фейле |
|------|--------------------------|
| Edge | Цепочка `ZAI_MODEL` → `ZAI_MODEL_FALLBACK`, до 2 попыток на модель. Все исчерпаны → HTTP **200** `{ text: <исходный>, skipped: true, error: "zai_1305" \| … }` |
| Клиент (`polishDictationText`) | invoke-error / network / timeout ~14 s / пустой `text` / `503 zai_key_missing` → возвращает исходную строку |
| Abort / pagehide / logout | polish **не** вызывается (не держим unload) |

Клиент всегда читает поле `data.text` — и при успехе, и при `skipped: true`. Поэтому «все модели молчат» = просто Web Speech без точек, не сломанный флоу.

## Секреты

Dashboard → Project Settings → Edge Functions → Secrets (или CLI):

```bash
supabase secrets set ZAI_API_KEY=<your-z-ai-key>
# опционально переопределить модели:
# supabase secrets set ZAI_MODEL=glm-4.5-flash
# supabase secrets set ZAI_MODEL_FALLBACK=glm-4.7-flash
```

| Secret | Обязателен | Назначение |
|--------|------------|------------|
| `ZAI_API_KEY` | да | Bearer к Z.AI |
| `ZAI_MODEL` | нет | default `glm-4.5-flash` |
| `ZAI_MODEL_FALLBACK` | нет | запасные модели через запятую; default `glm-4.7-flash` |
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | авто | проверка JWT через `auth.getUser()` |

Ключ **никогда** не класть в клиент / `.env` бандла / git (см. `.cursor/rules/security.mdc`).

Без `ZAI_API_KEY` Function отвечает `503` `{ "error": "zai_key_missing" }` → клиент fallback на сырой текст.

## Контракт

`POST` JSON, заголовок `Authorization: Bearer <user JWT>` (+ `apikey` anon как обычно у `functions.invoke`):

```json
{ "text": "ну короче кейс слабый", "locale": "ru", "maxLen": 4000 }
```

| Поле | Тип | По умолчанию | Смысл |
|------|-----|--------------|--------|
| `text` | string | — | сырой транскрипт |
| `locale` | string | `ru` | `ru` / `en` → system prompt |
| `maxLen` | number | `4000` | потолок (clamp 8…8000); notes `4000`, advice `1000` |

Успех (`model` — какая модель реально ответила):

```json
{ "text": "Ну, короче: кейс слабый.", "model": "glm-4.5-flash" }
```

Пропуск / soft-fail (HTTP 200, клиент всё равно берёт `text`):

```json
{ "text": "<исходный>", "skipped": true, "error": "zai_1305" }
```

| Ситуация | HTTP | Тело |
|----------|------|------|
| пустой / слишком короткий (`< 8` символов) | 200 | `skipped: true`, исходный текст |
| нет JWT / мёртвый user | 401 | `{ error: "unauthorized" }` |
| нет `ZAI_API_KEY` | 503 | `{ error: "zai_key_missing" }` |
| Z.AI 4xx/5xx, abort, пустой ответ модели | 200 | `skipped: true` + исходный `text` |

Коды `error` при soft-fail: `zai_<код Z.AI>` (например `zai_1305`), `empty_model`, `fetch_failed`, `deadline`, `upstream_failed`.

Бюджет запроса: попытка **7 s**, суммарно **12 s**. Клиентский race: **14 s**.

## Модель, ретраи и смена провайдера

Default: **`glm-4.5-flash`**, запасная — `glm-4.7-flash` (обе Free на [docs.z.ai pricing](https://docs.z.ai/guides/overview/pricing)).

Функция идёт по цепочке `ZAI_MODEL` → `ZAI_MODEL_FALLBACK`, на каждой модели до 2 попыток с паузой 600 ms. Повтор — только на «перегрузку»: HTTP 429/5xx и коды Z.AI `1302` / `1303` / `1305`. Неретраибельные (`1113` нет баланса, `1304` дневной лимит) сразу переключают модель.

`glm-4.7-flash` на free-тире регулярно отдаёт `1305` («service temporarily overloaded») — поэтому основная именно `4.5`.

Смена модели = `ZAI_MODEL` или правка адаптера в `index.ts`.  
Клиентский контракт `{ text } → { text }` не трогать: тогда можно заменить Z.AI на другой OpenAI-compatible endpoint одной правкой Function.

`thinking: { type: "disabled" }` обязателен: иначе reasoning съедает `max_tokens` и `content` приходит пустым (`empty_model`).

## Когда вызывается (клиент)

| Момент | Что полируется |
|--------|----------------|
| Toggle stop на `/review` (notes) | `dictationText` |
| Toggle stop в квизе (advice) | поле `#review-advice` → `setAdviceText` |
| Конец таймера → `openReview` | notes (`stop` + `polish: true`, async) |
| `onComplete` перед submit | `dictation` + `advice` ещё раз (страховка) |

Abort / `pagehide` / logout — **без** polish (не держим unload).

## Deploy

```bash
supabase functions deploy polish-dictation --project-ref xshfpkefdvhmrwrhhuoo
```

Проект: `xshfpkefdvhmrwrhhuoo`. Dashboard: [Functions](https://supabase.com/dashboard/project/xshfpkefdvhmrwrhhuoo/functions).

## Проверка

1. Secret `ZAI_API_KEY` задан.
2. Залогиненный юзер → `/review` → rec → stop.
3. DevTools → Network → `polish-dictation` → `200`, в JSON есть `text` с пунктуацией.
4. Без секрета / offline → submit всё равно уходит с сырым текстом.

## Риски

- Free-tier Z.AI часто ~1 concurrent request — пик ревьюеров → `zai_1305` / `skipped` даже после ретраев.
- Текст заметок уходит на Z.AI (сторонний провайдер) — только то, что юзер надиктовал.
- Цена `$0` на Flash не гарантирована навсегда — держать абстракцию в Edge.
