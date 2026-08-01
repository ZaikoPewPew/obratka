# Edge Function: `polish-dictation`

Post-edit сырого Web Speech транскрипта (пунктуация / пробелы / регистр).  
**Не** STT: аудио не принимаем. Смысл текста не меняем.

Клиент: [`src/api/dictationPolish.js`](../../../src/api/dictationPolish.js) → после stop rec / перед submit.

## Секреты

Dashboard → Edge Functions → Secrets (или CLI):

```bash
supabase secrets set ZAI_API_KEY=<your-z-ai-key>
# опционально:
# supabase secrets set ZAI_MODEL=glm-4.7-flash
```

`SUPABASE_URL` / `SUPABASE_ANON_KEY` подставляет платформа.  
Ключ **никогда** не класть в клиент / `.env` бандла / git.

## Контракт

`POST` (JWT обязателен, `verify_jwt = true`):

```json
{ "text": "ну короче кейс слабый", "locale": "ru", "maxLen": 4000 }
```

Ответ:

```json
{ "text": "Ну, короче: кейс слабый." }
```

При коротком тексте / ошибке upstream / отсутствии ключа — `{ text: <исходный>, skipped: true }` (или `503` только если нет `ZAI_API_KEY` на холодном старте без fallback-пути; в коде без ключа — `503 zai_key_missing`).

## Модель

По умолчанию `glm-4.7-flash` (Free на [docs.z.ai pricing](https://docs.z.ai/guides/overview/pricing)).  
Смена модели = `ZAI_MODEL` или правка адаптера в `index.ts` — клиентский контракт тот же.

## Deploy

```bash
supabase functions deploy polish-dictation --project-ref xshfpkefdvhmrwrhhuoo
```

Или MCP `deploy_edge_function` с `verify_jwt: true`.
