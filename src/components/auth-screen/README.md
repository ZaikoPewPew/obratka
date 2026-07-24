# `auth-screen` — регистрация

Path: **`/registration`**. Split как `url-screen`; форма — email → divider → провайдеры.  
Код из письма — отдельный экран [`auth-code-screen`](../auth-code-screen/README.md) (`/registration/code`).

## Левая панель

1. Заголовок (`authWelcomeTitle`)
2. Email + стрелка submit
3. Разделитель (`authDividerOr`)
4. Кнопки: Telegram / Google

## Файл

- `AuthScreen.js` — `createAuthScreen({ onSuccess, mode? })` → `{ root, open, close, setMode }`.

## Visual и ошибки

| Источник ошибки | Outline инпута | Текст | Visual `invalid` |
|-----------------|----------------|-------|------------------|
| Email (валидация / OTP send) | да — `setUrlScreenFieldInvalid` | да | да (OR) |
| Provider (Telegram / Google) | нет | да — `setFieldErrorVisible` на providerError | да (OR) |

Правый visual: [`brand-screen-visual`](../brand-screen-visual/README.md).  
Полный контракт поля: [`FIELD_ERROR.md`](../../utils/FIELD_ERROR.md).  
Visual `invalid`, пока видна **любая** ошибка (email **или** provider).

## Поведение

- **Email** → `requestEmailOtp` → `onSuccess({ type: 'email-otp-sent', email })` → `main.js` открывает `authCode`.
- **Telegram** → Login Widget → Edge Function `telegram-auth` →  
  `onSuccess({ type: 'telegram', userId, … })`.
- **Google** → `signInWithGoogle()` → редирект → `completeOAuthFromUrl()` в `main.js`.
- Busy-состояния на submit / провайдерах, `aria-busy`.
- Пока один способ занят — остальные дизейблятся (email ↔ Telegram ↔ Google).
- Лоадеры провайдеров: Telegram — цвет иконки, Google — палитра Google.
- Ошибки OTP / identity conflict → `emailOtpErrorMessage` / `googleErrorMessage` (`authIdentityConflict`, `authOtpRateLimit`, …).
- После OAuth fail: `obratka.authProviderError` из `sessionStorage` при следующем `open`.

## Env / Dashboard

См. `.env.example` и `supabase/functions/telegram-auth/README.md`:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`
- `TELEGRAM_BOT_ID` (число до `:` в токене BotFather)
- секрет `TELEGRAM_BOT_TOKEN` только в Edge Function secrets

### Email (Supabase Auth → Providers → Email)

1. Включить Email provider.
2. **Важно:** `signInWithOtp` по умолчанию шлёт **magic link**, не 6-значный код.  
   Чтобы приходил код для экрана `/registration/code`, поменяй шаблон письма:

   **Authentication → Email Templates → Magic Link** (и при необходимости Confirm signup):

   - убери или не опирайся только на `{{ .ConfirmationURL }}`;
   - добавь код: `{{ .Token }}` (6 цифр).

   Пример тела:

   ```text
   Ваш код для входа: {{ .Token }}
   ```

   Если в шаблоне есть только ссылка — на почту придёт ссылка, а UI с ячейками кода не сработает.
3. Redirect URLs (для Google / ссылок, если оставишь):
   - `http://localhost:5173/`
   - `https://zaikopewpew.github.io/obratka/`

### Google (Supabase Auth → Providers → Google)

1. [Google Cloud Console](https://console.cloud.google.com/) → OAuth client (Web):
   - Authorized JavaScript origins: `http://localhost:5173`, `https://zaikopewpew.github.io`
   - Authorized redirect URI: `https://<project-ref>.supabase.co/auth/v1/callback`
2. Client ID + Secret → Supabase Dashboard → Authentication → Providers → Google.

### Identity linking (Email ↔ Google)

**Automatic linking** в Supabase Auth **включён по умолчанию**: одна **verified** email → один `auth.users`. Отдельный тоггл «включить automatic linking» в Dashboard нет.

Чеклист (Dashboard → Authentication):

1. Providers → Email и Google включены; Google отдаёт verified email.
2. Redirect URLs только ваши origins (localhost + Pages), Site URL корректен.
3. **Manual linking** (`linkIdentity`) **не включать** — UI привязки провайдеров вне скоупа (см. `PROJECT.md` roadmap #4).
4. Telegram изолирован (`tg{id}@t.me`) и **не** склеивается с Email/Google через automatic linking.

Если Auth вернёт конфликт identity — UI показывает `authIdentityConflict`.

## i18n

`authWelcomeTitle`, `authEmail*`, `authDividerOr`, `authTelegram`, `authGoogle`,  
`authProviderConnecting`, provider errors, `authOtpSendError` / `authOtpRateLimit` /  
`authOtpNotConfigured` / `authIdentityConflict`.

## Стили

`.auth-screen__*` + `.url-screen*` в `iframe-shell.css`; токены `--auth-screen-*`.

См. [`SCREENS.md`](../../../SCREENS.md).
