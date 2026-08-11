# `auth-screen` — регистрация

Path: **`/registration`**. Split как `url-screen`; форма — провайдеры (Telegram / Google).  
Email OTP сейчас **выключен** (`EMAIL_AUTH_ENABLED` в [`src/config/auth.js`](../../config/auth.js)); код из письма — [`auth-code-screen`](../auth-code-screen/README.md) (`/registration/code`), deep link без флага → `/registration`.

## Левая панель

1. Заголовок (`authWelcomeTitle`)
2. ~~Email + стрелка submit~~ (скрыто, пока `EMAIL_AUTH_ENABLED === false`)
3. ~~Разделитель (`authDividerOr`)~~ (скрыт вместе с email)
4. Кнопки: Telegram / Google

## Файл

- `AuthScreen.js` — `createAuthScreen({ onSuccess, onAuthStarted?, onAuthFailed?, mode? })` → `{ root, open, close, setMode }`.
  - `onAuthStarted({ provider })` — клик Telegram / Google (до сети).
  - `onAuthFailed({ provider, code })` — ошибка провайдера; **не** вызывается на `telegram_cancelled` / `google_cancelled` / `access_denied`.
  - Аналитика: колбэки → `track` в `main.js` (`auth_started` / `auth_failed`); SoT — [`ANALYTICS.md`](../../../ANALYTICS.md).

## Visual и ошибки

| Источник ошибки | Outline инпута | Текст | Visual `invalid` |
|-----------------|----------------|-------|------------------|
| Email (валидация / OTP send) | да — `setUrlScreenFieldInvalid` | да | да (OR); только если email включён |
| Provider (Telegram / Google) | нет | да — `setFieldErrorVisible` на providerError | да (OR) |

Правый visual: [`brand-screen-visual`](../brand-screen-visual/README.md).  
Полный контракт поля: [`FIELD_ERROR.md`](../../utils/FIELD_ERROR.md).  
Visual `invalid`, пока видна **любая** ошибка (email **или** provider).

## Поведение

- **Email** (если `EMAIL_AUTH_ENABLED`) → `requestEmailOtp` → `onSuccess({ type: 'email-otp-sent', email })` → `main.js` открывает `authCode`.
- **Telegram** → Login Widget → Edge Function `telegram-auth` →  
  `onSuccess({ type: 'telegram', userId, … })`.
- **Google** → `signInWithGoogle()` → редирект → `completeOAuthFromUrl()` в `main.js`.
- Busy-состояния на submit / провайдерах, `aria-busy`.
- Пока один способ занят — остальные дизейблятся (email ↔ Telegram ↔ Google).
- Лоадеры провайдеров: Telegram — цвет иконки, Google — палитра Google.
- Ошибки OTP / identity conflict → `emailOtpErrorMessage` / `googleErrorMessage` (`authIdentityConflict`, `authOtpRateLimit`, …).
- После OAuth fail: `obratka.authProviderError` из `sessionStorage` при следующем `open`.

## Env / Dashboard

Быстрая проверка (env + `external.email`, без отправки писем):

```bash
node --env-file=.env scripts/verify-email-otp-setup.mjs
```

### Email (Supabase Auth → Providers → Email)

Сейчас UI скрыт. Чтобы вернуть:

1. `EMAIL_AUTH_ENABLED = true` в `src/config/auth.js`.
2. Включить Email provider (проверка: `GET /auth/v1/settings` → `external.email: true`).
3. **Сначала custom SMTP** (Dashboard → Authentication → Emails → SMTP Settings).
   Без SMTP на Free **нельзя править** шаблоны («Set up custom SMTP to edit templates») — уходят дефолты. Для UI `/registration/code` дефолт Confirm signup = только ссылка (проверено: link-only). SMTP: Unisender Go / Resend / Postmark — креды только в Dashboard, см. [`SECURITY.md`](../../../supabase/SECURITY.md).
4. **Критично для `/registration/code`:** в письме должен быть **`{{ .Token }}`** (6 цифр).
   При `mailer_autoconfirm: false` (Confirm email включён) первый `signInWithOtp` для **нового** юзера часто шлёт **Confirm sign up**. Дефолт без `{{ .Token }}` — ячейки кода не сработают.

   После SMTP → **Emails → Templates**, правь оба:

   - **Magic link or OTP**
   - **Confirm sign up**

   Минимум в body:

   ```text
   Ваш код для входа: {{ .Token }}
   ```

   Альтернатива: Providers → Email → выключить **Confirm email** (`mailer_autoconfirm`), тогда уходит Magic link or OTP; всё равно добавь `{{ .Token }}` в этот шаблон.
5. Redirect URLs (Authentication → URL Configuration):
   - `http://localhost:5173/`
   - `https://obratka.net/`

### Telegram

1. BotFather → bot; `TELEGRAM_BOT_ID` / `TELEGRAM_BOT_USERNAME` в `.env`.
2. `TELEGRAM_BOT_TOKEN` → Edge Function secrets (`telegram-auth`).
3. секрет `TELEGRAM_BOT_TOKEN` только в Edge Function secrets

### Google

1. Google Cloud Console → OAuth client (Web).
2. Client ID + Secret → Supabase Dashboard → Authentication → Providers → Google.

### Identity linking (Email ↔ Google)

**Automatic linking** в Supabase Auth **включён по умолчанию**: одна **verified** email → один `auth.users`. Отдельный тоггл «включить automatic linking» в Dashboard нет.

Чеклист (Dashboard → Authentication):

1. Providers → Email и Google включены; Google отдаёт verified email.
2. Redirect URLs только ваши origins (localhost + Pages), Site URL корректен.
3. **Manual linking** (`linkIdentity`) **не включать** — UI привязки провайдеров вне скоупа (см. `PROJECT.md` roadmap #2).
4. Telegram изолирован (`tg{id}@t.me`) и **не** склеивается с Email/Google через automatic linking.

Если Auth вернёт конфликт identity — UI показывает `authIdentityConflict`.

## i18n

`authWelcomeTitle`, `authEmail*`, `authDividerOr`, `authTelegram`, `authGoogle`,
`authProviderConnecting`, provider errors, `authOtpSendError` / `authOtpRateLimit` /
`authOtpNotConfigured` / `authIdentityConflict`.
