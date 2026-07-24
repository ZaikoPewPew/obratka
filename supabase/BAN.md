# Бан пользователей (оператор)

Источник правды: колонка **`public.profiles.banned_at`**.  
Если значение **не `null`** → пользователь на экране [`/banned`](../src/components/ban-screen/README.md).  
`ban_reason` — только для тебя (в UI не показывается).

Клиент сайта **не может** сам поставить/снять бан. Менять можно из **Supabase Dashboard** (SQL Editor или Table Editor).

Dashboard проекта: [supabase.com/dashboard](https://supabase.com/dashboard) → проект **obratka**.

---

## Где что нажимать

Левая узкая колонка иконок:

| Иконка (сверху вниз) | Раздел |
|----------------------|--------|
| 1. таблица | **Table Editor** — править строки руками |
| 2. `>_` / терминал | **SQL Editor** — вставить шаблон и Run |
| … | Database, Storage, Auth, … |

Таблица: слева выбери **`profiles`** (schema `public`).

---

## Способ A — Table Editor (без SQL)

1. Table Editor → `profiles`.
2. Найди юзера (`display_name`, `email`, `telegram_username`, …). При необходимости прокрути колонки вправо до **`banned_at`** / **`ban_reason`**.
3. **Забанить:** в `banned_at` поставь текущее время; в `ban_reason` текст причины (например `toxicity`).
4. **Разбанить:** очисти оба поля (`null` / пусто).
5. Сохрани ячейку (Enter / клик вне).

После обновления страницы сайта забаненный увидит `/banned`.

---

## Способ B — SQL Editor (шаблоны)

SQL Editor (вторая иконка) → New query → вставь шаблон → подставь значение → **Run**.

### Забанить по `id` (uuid)

```sql
update public.profiles
set
  banned_at = now(),
  ban_reason = 'toxicity'  -- toxicity | bad_reviews | spam | other
where id = '00000000-0000-0000-0000-000000000000';
```

### Забанить по email

```sql
update public.profiles
set
  banned_at = now(),
  ban_reason = 'toxicity'
where email = 'user@example.com';
```

### Забанить по Telegram username (без @)

```sql
update public.profiles
set
  banned_at = now(),
  ban_reason = 'toxicity'
where telegram_username = 'username';
```

### Забанить по `telegram_id`

```sql
update public.profiles
set
  banned_at = now(),
  ban_reason = 'toxicity'
where telegram_id = 123456789;
```

### Разбанить (любой из ключей)

```sql
update public.profiles
set
  banned_at = null,
  ban_reason = null
where id = '00000000-0000-0000-0000-000000000000';
-- или: where email = 'user@example.com';
-- или: where telegram_username = 'username';
```

### Найти, кого банить

```sql
select id, email, display_name, telegram_username, telegram_id, banned_at, ban_reason
from public.profiles
where email ilike '%@%'
   or display_name ilike '%Имя%'
   or telegram_username ilike '%nick%'
order by created_at desc;
```

### Список уже забаненных

```sql
select id, email, display_name, telegram_username, banned_at, ban_reason
from public.profiles
where banned_at is not null
order by banned_at desc;
```

Те же шаблоны лежат в [`sql/ban-templates.sql`](sql/ban-templates.sql) — удобно копировать целиком.

---

## Что видит пользователь

| Поле | Эффект |
|------|--------|
| `banned_at IS NOT NULL` | Экран «Твой аккаунт заблокирован»; кнопки «Связаться» / «Выйти» |
| Deep link `/home`, back, … | Схлопывается обратно на `/banned` (пока сессия с `banned`) |
| «Выйти» | sign-out → `/referral` (повторный логин того же аккаунта снова на `/banned`) |
| INSERT portfolio / review | RLS отклоняет (`is_profile_banned`) |

Снять бан → `banned_at = null` → после reload снова обычный флоу.

---

## Типичные причины (`ban_reason`)

Свободный текст; удобные метки:

| Значение | Когда |
|----------|--------|
| `toxicity` | токсичность / оскорбления |
| `bad_reviews` | плохие / бессмысленные отзывы |
| `spam` | спам, накрутка |
| `other` | прочее (лучше дописать словами) |

---

## Если снова ошибка `profiles.ban fields are read-only`

Триггер `protect_profiles_ban` режет **клиентский** JWT. В **SQL Editor** и Table Editor (роль postgres) правки должны проходить.  
Если ловишь `P0001` — проверь, что запрос идёт из Dashboard SQL Editor проекта, а не из клиентского API.
