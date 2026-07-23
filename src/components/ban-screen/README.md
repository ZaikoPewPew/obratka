# `ban-screen` — аккаунт заблокирован

Path: **`/banned`** (`banned`).

Показывается когда у `profiles.banned_at` есть значение. Из экрана нельзя уйти навигацией / deep link / history — `go` / `resolveAccessibleRoute` / `resolveEntryScreen` всегда схлопывают на `banned`. Единственное действие — «Связаться» → Telegram админа.

## Layout

Split как у `success-screen`: слева тайтл + подтайтл + серая кнопка, справа красный mesh (`#FF4837` family) + brand mark с огнём (44×37, низ/право как у обычного 44×30).

## Копирайт

| Ключ | RU |
|------|-----|
| `banTitle` | Ваш аккаунт заблокирован |
| `banBody` | Свяжитесь с администратором сообщества |
| `banContact` | Связаться |

Контакт: `BAN_CONTACT_URL` в `BanScreen.js` → `https://t.me/ezzzz12345`.

## API

`createBanScreen()` → `{ root, open, close }`

Монтаж и ловушка маршрутов — в `main.js`.

## Бан оператором

```sql
update public.profiles
set banned_at = now(), ban_reason = 'toxicity'
where id = '<user-uuid>';

-- снять:
update public.profiles
set banned_at = null, ban_reason = null
where id = '<user-uuid>';
```

Колонки `banned_at` / `ban_reason` клиенту read-only (триггер `protect_profiles_ban`). INSERT в `portfolios` / `reviews` для забаненных режет RLS (`is_profile_banned`).

## Стили

`styles/ban-screen.css` + токены `--ban-screen-*`, `--shell-ban-mesh-*`.

См. [`SCREENS.md`](../../../SCREENS.md).
