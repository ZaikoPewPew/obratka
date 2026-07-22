# `auth-screen` — вход и регистрация

Экран создания аккаунта / авторизации.

## Визуал

На базе `brand-screen-shell` (эталон — «Ссылка на портфолио»): правый visual общий, слева форма.

Motion: staggered reveal как у `url-screen`.

## Файл

- `AuthScreen.js` — `createAuthScreen({ onSuccess, mode? })` → `{ root, open, close, setMode }`.
- Статус: **каркас**, не монтируется из `main.js`.

## Режимы

| Mode | Смысл | Заголовок (i18n) |
|------|--------|------------------|
| `sign-in` | Вход | `authSignInTitle` |
| `sign-up` | Регистрация | `authSignUpTitle` |

Переключение внутри левой панели без смены правого visual.

## Поведение (план)

1. Email + пароль (+ поля регистрации по продукту).
2. Вызов `src/api/auth.js` → запись сессии в `src/app/session.js`.
3. `onSuccess(session)` → `onboarding-screen` (новый пользователь) или `home-screen`.

## i18n

Ключи `auth*` в `content/locales.json` (`authEmailLabel`, `authPasswordLabel`, submit/switch, `authStubHint`).

## Зависимости

- `brand-screen-shell`
- `src/api/auth.js` (stub)
- `src/app/session.js`
- при необходимости переиспользовать паттерны `EmailField`

См. [`SCREENS.md`](../../../SCREENS.md).
