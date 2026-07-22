# `src/app/` — флоу и сессия

Слой над компонентами экранов: порядок шагов, skip-правила, локальная сессия пользователя.

Пока **не подключено** к `main.js` (точка входа по-прежнему открывает `url-screen`).

## Состав

| Файл | Роль |
|------|------|
| `flow.js` | `APP_FLOW`, `getNextScreen`, `resolveEntryScreen` |
| `session.js` | `getSession` / `setSession` / `clearSession` / `hasSession` (localStorage `obratka.session`) |

## Порядок экранов

```text
referral → auth → onboarding → home → url → session
```

См. корневой [`SCREENS.md`](../../SCREENS.md).

## Правило

Компоненты не знают о следующем экране — только колбэки (`onSubmit`, `onSuccess`, `onComplete`). Переходы живут здесь.
