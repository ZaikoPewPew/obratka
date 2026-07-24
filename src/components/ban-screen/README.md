# `ban-screen` — аккаунт заблокирован

Path: **`/banned`** (`banned`).

Показывается когда у `profiles.banned_at` есть значение. Из экрана нельзя уйти навигацией / deep link / history — `go` / `resolveAccessibleRoute` / `resolveEntryScreen` всегда схлопывают на `banned`. Единственное действие — «Связаться» → Telegram админа.

## Layout

Split как у `success-screen`: слева тайтл + подтайтл + кнопки (**Выйти** серая → **Связаться** тёмная), справа красный mesh (`--shell-ban-mesh-*`) + **статичный** `banBrandMarkSvg` (полный evil **44×52**).

**Не** использует `createBrandScreenVisual` / `setVariant("invalid")` — это отдельный экран-ловушка, не brand-gate с полем.  
Морф рожек без resize — только на referral/auth/auth-code/url; см. [`brand-screen-visual`](../brand-screen-visual/README.md), [`assets/README.md`](../../assets/README.md).

## Копирайт

| Ключ | RU |
|------|-----|
| `banTitle` | Твой аккаунт заблокирован |
| `banBody` | Свяжись с администратором сообщества |
| `banContact` | Связаться |
| `banExit` | Выйти |

Контакт: `BAN_CONTACT_URL` в `BanScreen.js` → `https://t.me/ezzzz12345`.  
Кнопки: ширина `--ban-screen-btn-width` (242px). «Выйти» — серая (`--color-surface-muted`). «Связаться» — accent (`--color-accent` / `#242426`) + белый текст. «Выйти» → `onExit` (sign-out → `/referral`).

## API

`createBanScreen({ onExit? })` → `{ root, open, close }`

Монтаж и ловушка маршрутов — в `main.js`.

## Бан оператором

Шпаргалка Dashboard + шаблоны: **[`supabase/BAN.md`](../../../supabase/BAN.md)**  
SQL copy-paste: [`supabase/sql/ban-templates.sql`](../../../supabase/sql/ban-templates.sql)

```sql
-- пример: бан по email
update public.profiles
set banned_at = now(), ban_reason = 'toxicity'
where email = 'user@example.com';

-- снять
update public.profiles
set banned_at = null, ban_reason = null
where email = 'user@example.com';
```

Колонки `banned_at` / `ban_reason` клиенту read-only (триггер `protect_profiles_ban`). INSERT в `portfolios` / `reviews` для забаненных режет RLS (`is_profile_banned`).

Автобан: жалобы на листы ревью снижают `profiles.reputation`; при пороге выставляется `banned_at` (`ban_reason = reputation`). Апелляция — «Связаться». См. [`supabase/BAN.md`](../../../supabase/BAN.md).

## Стили

`styles/ban-screen.css` + токены `--ban-screen-*`, `--shell-ban-mesh-*`.

См. [`SCREENS.md`](../../../SCREENS.md).
