# `settings-screen`

Отдельный экран `/settings`, открываемый из меню профиля (`account-menu`).

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

Сохранение — `updateMySettings` → allowlist patch через `updateMyProfile`. Системные поля (`email`, `grade`, `balance`, …) клиент не пишет. После save `main.js` зовёт `refreshSessionFromProfile`, чтобы home / account-menu подхватили имя и роль.

**SQL:** блок `workplace` / identity guards / column grants из [`supabase/sql/profiles.sql`](../../../supabase/sql/profiles.sql) уже применён на prod (см. [`supabase/SECURITY.md`](../../../supabase/SECURITY.md) § Миграции). Без колонки `workplace` любой `select` профиля отдаёт 400 — не деплоить фронт на базу без неё.

Компонент сообщает о возврате через `onBack`; клик по логотипу → `onGoFeed` (вкладка «На ревью»). History и `go()` остаются в `main.js`. Deep link `/settings` — после онбординга (`flow.js`).

Стили: `styles/settings-screen.css`. Токены: `--settings-screen-*`. i18n: `settings*`.
