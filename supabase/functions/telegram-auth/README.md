# Edge Function: `telegram-auth`

Проверяет данные [Telegram Login Widget](https://core.telegram.org/widgets/login), создаёт/находит пользователя в Supabase Auth и возвращает `token_hash` для клиентского `verifyOtp` (не session JWT).

`auth_date` принимается не старше **1 часа**. `telegram_id` пишется в `app_metadata` (не в `user_metadata`).

## Секреты проекта

В Dashboard → Edge Functions → Secrets (или CLI):

```bash
supabase secrets set TELEGRAM_BOT_TOKEN=<token_from_BotFather>
```

`SUPABASE_URL` и `SUPABASE_SERVICE_ROLE_KEY` подставляются платформой автоматически.

Admin-клиент **обязательно** шлёт `Authorization: Bearer <service_role>` (не JWT вызывающего). Иначе Auth Admin (`createUser` / `generateLink`) периодически отвечает `403 bad_jwt` (`unrecognized JWT kid` / ES256) — особенно при повторном входе после `signOut`.

## BotFather

1. `@BotFather` → `/newbot` (или взять существующего).
2. Скопировать **token** (`123456:ABC…`) и **username**.
3. Число до `:` — это `TELEGRAM_BOT_ID` для фронта.
4. `/setdomain` → домен сайта без схемы:
   - локально: `localhost` (иногда нужен туннель с публичным доменом);
   - Pages: `zaikopewpew.github.io`.

## Клиент

`.env` / `.env.local`:

```env
TELEGRAM_BOT_ID=123456789
TELEGRAM_BOT_USERNAME=YourBotUsername
```

`verify_jwt` для этой функции **выключен**: входящий запрос подписывает Telegram (`hash`), не Supabase JWT.
