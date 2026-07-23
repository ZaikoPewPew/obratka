# `auth-screen` — регистрация

Path: **`/registration`**. Split как `url-screen`; форма — стиль старого PDF/done (email → divider → провайдеры).

## Левая панель

1. Заголовок (`authWelcomeTitle`): «Добро пожаловать! / Давайте создадим аккаунт»
2. Email (`authEmailPlaceholder`: `your@email.com`) + стрелка submit
3. Разделитель (`authDividerOr`): «или войдите с помощью»
4. Серые кнопки: Telegram / Google

## Файл

- `AuthScreen.js` — `createAuthScreen({ onSuccess, mode? })` → `{ root, open, close, setMode }`.
- `open(mode | { handoff }?, { handoff? })`, `close({ handoff? })`.

## Поведение

- Email → `onSuccess({ type: 'email', email })`.
- Telegram / Google (stub) → `onSuccess({ type: 'telegram' | 'google' })`.
- Happy-path: `go("url", { handoff: true })` (онбординг/home пока пропускаются).

## i18n

`authWelcomeTitle`, `authEmailLabel`, `authEmailPlaceholder`, `authEmailSubmitAria`, `authEmailInvalid`, `authDividerOr`, `authTelegram`, `authGoogle`.

## Стили

`.auth-screen__*` + оболочка `.url-screen*` в `iframe-shell.css`; токены `--auth-screen-*`, палитра Google/Telegram в `tokens.css`.

См. [`SCREENS.md`](../../../SCREENS.md).
