# `src/lib/` — клиентские библиотеки

| Модуль | Роль |
|--------|------|
| [`supabaseClient.js`](supabaseClient.js) | Единственный браузерный `createClient` (URL + **anon**). Не плодить клиенты с другим ключом. Кэш JWT (`getCachedAccessToken` / `refreshCachedAccessToken`) для unload keepalive. |
| [`dictation/`](dictation/README.md) | `DictationEngine` — надиктовка на `/review` и в поле «Главный совет» (Web Speech MVP; план B = Whisper Edge). Post-edit пунктуации — отдельно через Edge `polish-dictation` / `src/api/dictationPolish.js` (не часть движка STT). |

Секреты / RLS: `.cursor/rules/security.mdc`. Диктовка: `.cursor/rules/dictation.mdc`.  
Polish Edge: [`supabase/functions/polish-dictation/README.md`](../../supabase/functions/polish-dictation/README.md).
