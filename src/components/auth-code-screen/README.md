# `auth-code-screen` — код из письма

Path: **`/registration/code`**. Split как `auth-screen` / `url-screen`.

## Левая панель

1. Кнопка «Назад» в верхнем левом углу form-pane (как `review-panel__top` в квизе)
2. Заголовок `authCodeTitle` («Отправили код»)
3. 6 квадратных ячеек на ширину email-инпута (`--url-screen-form-width`); единый скрытый input
4. «Отправить ещё раз» — текст как `auth-screen__divider-label`; во время cooldown — `authCodeResendWait`

## Файл

- `AuthCodeScreen.js` — `createAuthCodeScreen({ onSuccess, onBack })` → `{ root, open(email), close }`.

## Поведение

- Открывается после успешного `requestEmailOtp` на `/registration`.
- `open(email)` — email из `sessionStorage` (`obratka.pendingAuthEmail`) / `main.js`.
- Полный код (6 цифр) → `verifyEmailOtp` → `onSuccess({ type: 'email', userId, email, … })`.
- Resend → `requestEmailOtp` снова.
- **Cooldown:** сразу после `open` и после успешного resend — `--auth-code-resend-cooldown` (по умолчанию `60s`), чтение в JS через `getAuthCodeResendCooldownMs()`; кнопка disabled, текст `authCodeResendWait` (`{seconds}`).
- Ошибки: `email_otp_invalid` / `email_otp_rate_limit` / `auth_identity_conflict` / `supabase_not_configured`.
- Назад → `onBack()` → `/registration` (handoff); cooldown сбрасывается в `close`.
- Deep link без pending email → `resolveAccessibleRoute` → `auth`.

## i18n

`authCodeTitle`, `authCodeLabel`, `authCodeResend`, `authCodeResendWait`, `authCodeBack`,  
плюс ошибки `authOtp*` / `authIdentityConflict`.

## Стили

`.auth-code-screen__*` в `iframe-shell.css`; токены `--auth-code-*` (в т.ч. `--auth-code-resend-cooldown`).  
Back переиспользует `.review-panel__back`.

См. [`SCREENS.md`](../../../SCREENS.md), [`auth-screen/README.md`](../auth-screen/README.md).
