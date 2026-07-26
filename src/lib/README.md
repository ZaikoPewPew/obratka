# `src/lib/` — клиентские библиотеки

| Модуль | Роль |
|--------|------|
| [`supabaseClient.js`](supabaseClient.js) | Единственный браузерный `createClient` (URL + **anon**). Не плодить клиенты с другим ключом. |
| [`dictation/`](dictation/README.md) | `DictationEngine` — надиктовка на `/review` и в поле «Главный совет» (Web Speech MVP; план B = Whisper Edge). |

Секреты / RLS: `.cursor/rules/security.mdc`. Диктовка: `.cursor/rules/dictation.mdc`.
