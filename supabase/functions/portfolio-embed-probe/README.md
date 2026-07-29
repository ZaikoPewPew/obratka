# Edge Function: `portfolio-embed-probe`

Серверный probe: можно ли показать портфолио во iframe чужого origin.

## Зачем

Браузер **не** читает `X-Frame-Options` / CSP `frame-ancestors` чужого ответа (CORS).  
После `load` и XFO `DENY` Chromium кидает `SecurityError` на `iframe.location` — **тот же сигнал**, что у живого cross-origin iframe. Клиентский `isLikelyFrameBlocked` это не отличит; без сервера UI не эскалирует в «Открыть и начать».

## Контракт

```
POST ${SUPABASE_URL}/functions/v1/portfolio-embed-probe
Authorization: Bearer <user JWT>
apikey: <anon>

{ "url": "https://…", "embedderOrigin": "https://zaikopewpew.github.io" }
```

Ответ:

```json
{ "canFrame": false, "reason": "xfo", "hostLabel": "Readymag", "status": 200 }
```

| Поле | Смысл |
|------|--------|
| `canFrame` | `false` → external UI; `true` → оставить iframe; `null` → неизвестно (сеть) |
| `reason` | `xfo` / `csp` / `csp_allow` / `default_allow` / `fetch_failed` |
| `hostLabel` | optional, напр. Readymag по HTML-маркерам |

`verify_jwt = true` (дефолт) — только авторизованные (review-флоу).

## Deploy

```bash
supabase functions deploy portfolio-embed-probe --project-ref <ref>
```

Клиент: `src/api/portfolioEmbedProbe.js` ← `main.js` на optimistic iframe.
