# `settings-screen`

Профиль в **side-panel** поверх home (deep link `/settings`).

Открывается из меню профиля (`account-menu`) или deep link.  
Не полный экран флоу: использует [`createSidePanel`](../side-panel/README.md) — sticky header (title + close) и sticky footer (Save + status), скролл только у формы.

## Поля

| Поле | Источник | Режим |
|------|----------|--------|
| Отображаемое имя | `profiles.display_name` | edit |
| Email | `profiles.email` | read-only (из Auth) |
| Telegram | `profiles.telegram_username` | edit, контактный (без verified ownership) |
| Грейд | `profiles.grade` | read-only (онбординг / лиги) |
| Профессия | `profiles.role` | select из `content/onboarding.json` |
| Где работаешь | `profiles.workplace` | edit, optional |
| Дата создания | `profiles.created_at` | read-only |

Сохранение — `updateMySettings` → allowlist patch. После save `main.js` зовёт `refreshSessionFromProfile`.  
Закрытие (крестик / backdrop / Escape) → `onClose` → `go("home")` с `lastHomeView`. History пишет только `main.js`.

## Открытие без лага

1. `applyRoute("settings")` не ждёт `reconcileSessionAccess()` (как `/report`): panel открывается по кэшу, ban/gone догоняют фоном.
2. Home уже на экране → `homeScreen.setView`, не `open()`: без повторного entrance-каскада и сброса скролла ленты (симметрично на возврате `settings → home`).
3. Форма рисуется из SWR-кэша профиля (`getCachedMyProfile` в `api/profiles.js`) и молча ревалидируется; если пользователь уже правит поля (`isDirty`), ответ ввод не затирает. Кэш чистится в `exitAuthenticatedSession` (`clearMyProfileCache`).

**SQL:** блок `workplace` / identity guards / column grants уже на prod (см. [`supabase/SECURITY.md`](../../../supabase/SECURITY.md)).

Стили формы: `styles/settings-screen.css` + `--settings-screen-*`. Каркас панели — `styles/side-panel.css`. i18n: `settings*`.
