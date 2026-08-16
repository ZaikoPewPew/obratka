# `src/lib/` — клиентские библиотеки

| Модуль | Роль |
|--------|------|
| [`supabaseClient.js`](supabaseClient.js) | Единственный браузерный `createClient` (URL + **anon**). Не плодить клиенты с другим ключом. Кэш JWT (`getCachedAccessToken` / `refreshCachedAccessToken`) для unload keepalive. |
| [`analytics.js`](analytics.js) | PostHog facade (`initAnalytics` / `trackPage` / `track` / `identifyUser` / `resetAnalytics`). Pageviews из `applyRoute` и лендоса; без `VITE_POSTHOG_KEY` — no-op. SoT: [`ANALYTICS.md`](../../ANALYTICS.md). |
| [`dictation/`](dictation/README.md) | `DictationEngine` — надиктовка на `/review` и в поле «Главный совет» (Web Speech MVP; план B = Whisper Edge). Post-edit пунктуации — отдельно через Edge `polish-dictation` / `src/api/dictationPolish.js` (не часть движка STT; **сейчас `POLISH_ENABLED = false`**). |

Секреты / RLS: `.cursor/rules/security.mdc`. Диктовка: `.cursor/rules/dictation.mdc`.  
Polish Edge: [`supabase/functions/polish-dictation/README.md`](../../supabase/functions/polish-dictation/README.md) (§ «Статус»).
