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
- **Google** → `signInWithGoogle()` (Supabase `signInWithOAuth`) → редирект на Google → возврат на корень приложения →  
  `completeOAuthFromUrl()` в `main.js` → сессия + профиль → `onboarding` / `home`.
- Пока ждём провайдера: на кнопке иконка → спиннер (`.auth-screen__provider--busy`),  
  `aria-busy` + `authProviderConnecting`.
- Happy-path: `onboarding` (или `home`, если `onboardingDone`).

## Env / Dashboard

См. `.env.example` и `supabase/functions/telegram-auth/README.md`:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_ID` (число до `:` в токене BotFather)
- секрет `TELEGRAM_BOT_TOKEN` только в Edge Function secrets

### Google (Supabase Auth → Providers → Google)

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth client (Web):
   - Authorized JavaScript origins: `http://localhost:5173`, `https://zaikopewpew.github.io`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Client ID + Secret → Supabase Dashboard → Authentication → Providers → Google.
3. Redirect URLs в Supabase (Authentication → URL Configuration):
   - `http://localhost:5173/`
   - `https://zaikopewpew.github.io/obratka/`

## i18n

`authWelcomeTitle`, `authEmail*`, `authDividerOr`, `authTelegram`, `authGoogle`,  
`authProviderConnecting`,  
`authTelegramError`, `authTelegramCancelled`, `authTelegramNotConfigured`,  
`authGoogleError`, `authGoogleCancelled`, `authGoogleNotConfigured`.

## Стили

`.auth-screen__*` + `.url-screen*` в `iframe-shell.css`; токены `--auth-screen-*`.

См. [`SCREENS.md`](../../../SCREENS.md).
