# `settings-screen`

Профиль в **side-panel** поверх home (deep link `/settings`).

Открывается из меню профиля (`account-menu` → «Профиль») или deep link.  
Не полный экран флоу: [`createSidePanel`](../side-panel/README.md) — sticky header (title + close), скролл у контента. **Footer пустой** (нет Save — все поля только для просмотра).

## Копирайт шапки

| Ключ | Содержание |
|------|------------|
| `settingsTitle` | «Профиль» / «Profile» |
| `settingsDescription` | `Аккаунт создан {date}.` — дата из `profiles.created_at` через `formatString` + `fixHangingPrepositions`; пустая → `settingsCreatedAtEmpty` |

## Поля

Все поля **read-only** (класс `.settings-screen__readonly`, muted фон/текст, `cursor: not-allowed`).  
Двухколоночные ряды `.settings-screen__row` (на узкой панели ≤640px — одна колонка):

| Ряд | Поля | Источник |
|-----|------|----------|
| 1 | Отображаемое имя · Telegram | `display_name`, `telegram_username` (`@…`) |
| 2 | Email (на всю ширину) | `email` |
| 3 | Специальность (на всю ширину) | `role` → лейбл из `onboarding.json`; визуал селекта + шеврон |
| 4 | Грейд · Где работаешь | `grade`, `workplace` |

Пустые значения → `settingsEmailEmpty` («Не указан» / «Not set»).

### Специальность (select look)

`.settings-screen__readonly--select`: значение + иконка-шеврон справа (`aria-hidden`).  
Отступ иконки от правого края — `--settings-screen-select-icon-inset` (24px).  
Цвет иконки = `--settings-screen-readonly-color` (приглушённый, как текст disabled).

Инпуты: высота **75px**, горизонтальный padding **24px** (`--settings-screen-input-*`). Gap между секциями — **24px** (`--settings-screen-form-gap`).

## Данные / оркестрация

- Рендер из SWR-кэша `getCachedMyProfile` + тихая ревалидация `fetchMyProfile`.
- Клиент **не** пишет профиль с этого экрана (нет `updateMySettings` / Save).
- Закрытие (крестик / backdrop / Escape) → `onClose` → `go("home")` с `lastHomeView`. History пишет только `main.js`.

## Открытие без лага

1. `applyRoute("settings")` не ждёт `reconcileSessionAccess()` (как `/report`): panel открывается по кэшу, ban/gone догоняют фоном.
2. Home уже на экране → `homeScreen.setView`, не `open()`: без повторного entrance-каскада и сброса скролла ленты (симметрично на возврате `settings → home`).
3. Кэш чистится в `exitAuthenticatedSession` (`clearMyProfileCache`).

Стили: [`styles/settings-screen.css`](../../../styles/settings-screen.css) + `--settings-screen-*` в [`tokens.css`](../../../styles/tokens.css).  
Каркас: [`styles/side-panel.css`](../../../styles/side-panel.css).  
i18n: `settings*` / `homeAccountSettings` («Профиль»).
