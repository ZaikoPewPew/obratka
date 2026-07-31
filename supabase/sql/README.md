# `supabase/sql/` — SQL-скрипты

## Состав

| Файл | Роль |
|------|------|
| `profiles.sql` | `public.profiles`, workplace, protect tier/ban/reputation/**balance**/grade/identity, column-level UPDATE, `is_profile_banned` (self-only), telegram_id из app_metadata |
| `legendary_presence.sql` | `last_seen_at` + RPC heartbeat/list для `tier=legendary` (после profiles) |
| `rating_leaderboard.sql` | снапшот топ-50 по `reputation` + RPC `list_rating_top` (ленивая пересборка раз в 24 ч; после profiles) |
| `wallet.sql` | `protect_profiles_balance` + RPC `spend_submit_cost` (legacy, cost 30) |
| `portfolio_submit.sql` | RPC `submit_portfolio` (atomic spend 30 + insert, max 1 pending); revoke client INSERT |
| `referrals.sql` | персональный `referral_code` (max 2 uses), seed `YTHWKPDWAK`, RPC validate/redeem; без наград |
| `portfolios.sql` | portfolios/reviews, лиги; SELECT only (INSERT через `submit_portfolio`) |
| `review_claims.sql` | claims + award balance (+10) в `handle_review_inserted`; `portfolio_reviewer_slots` / claim / heartbeat зовут `purge_expired_review_claims` + `settle_review_reputation_rewards` |
| `review_complaints.sql` | reputation (старт 0, бан −100, 1 тег, окно 6ч от done, +10 settle) + RPC complaint. ONE-SHOT `100/20 → 0` уже применён на prod — в файле закомментирован |
| `subscribers_count.sql` | RPC count (legacy) |
| `subscribers_rls.sql` | RLS + revoke на live `subscribers`, если таблица есть |
| `ban-templates.sql` | операторский бан / разбан |
| `delete-account-templates.sql` | удаление тестового аккаунта |
| `portfolio-role-backfill.sql` | одноразовый backfill `portfolios.role` (Lead/Head naming) |
| `portfolio_preview_cache.sql` | Storage-бакет `portfolio-previews` (публичный read, без client write) для Edge `portfolio-preview` |

## Как применять

1. Dashboard проекта **obratka** → **SQL Editor** (вторая иконка слева) → New query.
2. Вставь содержимое нужного `.sql` (или точечный блок) → **Run**.
3. Альтернатива: MCP `apply_migration` / CLI `supabase db` — тот же SQL.

Порядок первого деплоя: `profiles` → `legendary_presence` → `rating_leaderboard` → `wallet` → `portfolios` → `portfolio_submit` → `review_claims` → `review_complaints` / `referrals`; при legacy — `subscribers_rls`.

### Повторный apply (уже живая БД)

Файлы в основном идемпотентны (`create or replace`, `if not exists`). Для claims:

| Что меняли | Что прогнать |
|------------|--------------|
| Весь claims-слой / overshoot (дверь без live, late insert, RLS insert на `done`) | весь [`review_claims.sql`](review_claims.sql) (drop CHECK + claim/trigger + `reviews_insert_own`) |
| Только слоты + purge expired | с `drop function … portfolio_reviewer_slots` до конца функции **и** `revoke`/`grant` на неё (в конце файла) |
| Окно жалобы от done + старт reputation 0 | [`portfolios.sql`](portfolios.sql) (колонка `completed_at`) → [`review_claims.sql`](review_claims.sql) (триггер) → весь [`review_complaints.sql`](review_complaints.sql); ONE-SHOT `100/20 → 0` на prod уже прогнан и в файле закомментирован — не раскомментировать при re-apply |
| Топ-50: метрика `balance` → `reputation` | весь [`rating_leaderboard.sql`](rating_leaderboard.sql) (rename колонки + RPC + `DELETE` снапшота; следующий `list_rating_top` пересоберёт) |
| Профиль `/settings`: `workplace` + identity guards + column UPDATE + grade-only lock | блок `workplace` / CHECK / `protect_profiles_grade` / `protect_profiles_identity` / grants в конце [`profiles.sql`](profiles.sql) (или весь файл) |

Клиентский фикс залипающих «Аноним»-слотов (keepalive `pagehide` + `sessionStorage` `obratka.reviewClaim`) **не** требует SQL — достаточно деплоя фронта. SQL-purge в `portfolio_reviewer_slots` — доп. hardening, чтобы expired не светились до следующего claim/heartbeat.

**Окно жалобы:** старт = `portfolios.completed_at`, не `updated_at`. Reopen для теста / ops — см. [`../BAN.md`](../BAN.md) § Автобан по репутации.

### Проверка после apply профиля (`/settings`)

Под своим JWT:

```sql
-- свои разрешённые поля (ожидание: ok)
update public.profiles
set display_name = display_name,
    telegram_username = telegram_username,
    role = role,
    workplace = workplace
where id = auth.uid();

-- identity / economy (ожидание: exception или 0 rows из-за column grant)
update public.profiles set email = 'pwned@example.com' where id = auth.uid();
update public.profiles set onboarding_done = false where id = auth.uid();
update public.profiles set grade = 'senior' where id = auth.uid() and onboarding_done;
update public.profiles set balance = balance + 1 where id = auth.uid();
```

Обзор — [`../README.md`](../README.md).  
**Как банить юзеров:** [`../BAN.md`](../BAN.md).  
**Кто какие RPC может звать:** [`../SECURITY.md`](../SECURITY.md).

## Новая функция — не забыть revoke

`PUBLIC` получает `EXECUTE` по умолчанию, а `anon` наследует его. Поэтому каждую новую функцию закрываем явно, иначе она сразу окажется в `/rest/v1/rpc/...` для незалогиненных:

```sql
revoke all on function public.my_rpc(uuid) from public;
revoke all on function public.my_rpc(uuid) from anon;
grant execute on function public.my_rpc(uuid) to authenticated;
```

Trigger-функции (`handle_new_user`, `handle_review_inserted`, `protect_*`) закрываем и от `authenticated`.
