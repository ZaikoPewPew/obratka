# `auth-screen` — регистрация

Path: **`/registration`**. Split как `url-screen`; форма — стиль старого PDF/done (email → divider → провайдеры).

## Левая панель

1. Заголовок (`authWelcomeTitle`)
2. Email + стрелка submit
3. Разделитель (`authDividerOr`)
4. Кнопки: Telegram / Google

## Файл

- `AuthScreen.js` — `createAuthScreen({ onSuccess, mode? })` → `{ root, open, close, setMode }`.

## Поведение

- Email → `onSuccess({ type: 'email', email })` (пока без Supabase email auth).
- **Telegram** → Login Widget popup → Edge Function `telegram-auth` → `supabase.auth.setSession` →  
  `onSuccess({ type: 'telegram', userId, email?, telegramId?, username?, … })`.
- Google — stub → `onSuccess({ type: 'google' })`.
- Happy-path в `main.js`: `onboarding` (или `home`, если `onboardingDone`).

## Env

См. `.env.example` и `supabase/functions/telegram-auth/README.md`:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_ID` (число до `:` в токене BotFather)
- секрет `TELEGRAM_BOT_TOKEN` только в Edge Function secrets

## i18n

`authWelcomeTitle`, `authEmail*`, `authDividerOr`, `authTelegram`, `authGoogle`,  
`authTelegramError`, `authTelegramCancelled`, `authTelegramNotConfigured`.

## Стили

`.auth-screen__*` + `.url-screen*` в `iframe-shell.css`; токены `--auth-screen-*`.

См. [`SCREENS.md`](../../../SCREENS.md).
