# `supabase/sql/` — SQL-скрипты

## Состав

| Файл | Роль |
|------|------|
| `profiles.sql` | `public.profiles`, protect tier/ban/reputation/**balance**/grade, `is_profile_banned` (self-only), telegram_id из app_metadata |
| `legendary_presence.sql` | `last_seen_at` + RPC heartbeat/list для `tier=legendary` (после profiles) |
| `rating_leaderboard.sql` | снапшот топ-50 по `balance` + RPC `list_rating_top` (ленивая пересборка раз в 24 ч; после profiles) |
| `wallet.sql` | `protect_profiles_balance` + RPC `spend_submit_cost` (legacy, cost 30) |
| `portfolio_submit.sql` | RPC `submit_portfolio` (atomic spend 30 + insert, max 1 pending); revoke client INSERT |
| `referrals.sql` | персональный `referral_code` (max 2 uses), seed `YTHWKPDWAK`, RPC validate/redeem; без наград |
| `portfolios.sql` | portfolios/reviews, лиги; SELECT only (INSERT через `submit_portfolio`) |
| `review_claims.sql` | claims + award balance (+10) в `handle_review_inserted` |
| `review_complaints.sql` | reputation + RPC complaint |
| `subscribers_count.sql` | RPC count (legacy) |
| `subscribers_rls.sql` | RLS + revoke на live `subscribers`, если таблица есть |
| `ban-templates.sql` | операторский бан / разбан |
| `delete-account-templates.sql` | удаление тестового аккаунта |
| `portfolio-role-backfill.sql` | одноразовый backfill `portfolios.role` (Lead/Head naming) |

Применять в SQL Editor Dashboard или через CLI. Порядок: `profiles` → `legendary_presence` → `rating_leaderboard` → `wallet` → `portfolios` → `portfolio_submit` → `review_claims` → `review_complaints` / `referrals`; при legacy — `subscribers_rls`.  
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
