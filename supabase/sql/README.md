# `supabase/sql/` — SQL-скрипты

## Состав

| Файл | Роль |
|------|------|
| `profiles.sql` | `public.profiles`, protect tier/ban/reputation/**balance**/grade, `is_profile_banned` (self-only), telegram_id из app_metadata |
| `wallet.sql` | `protect_profiles_balance` + RPC `spend_submit_cost` (+ temp `temp_credit_balance` для тестов) |
| `referrals.sql` | персональный `referral_code` (max 2 uses), seed `YTHWKPDWAK`, RPC validate/redeem; без наград |
| `portfolios.sql` | portfolios/reviews, лиги; INSERT WITH CHECK pending/0/target=3 |
| `review_claims.sql` | claims + award balance (+1) в `handle_review_inserted` |
| `review_complaints.sql` | reputation + RPC complaint |
| `subscribers_count.sql` | RPC count (legacy) |
| `subscribers_rls.sql` | RLS + revoke на live `subscribers`, если таблица есть |
| `ban-templates.sql` | операторский бан / разбан |
| `delete-account-templates.sql` | удаление тестового аккаунта |
| `portfolio-role-backfill.sql` | одноразовый backfill `portfolios.role` (Lead/Head naming) |

Применять в SQL Editor Dashboard или через CLI. Порядок: `profiles` → `wallet` → `portfolios` → `review_claims` → `review_complaints` / `referrals`; при legacy — `subscribers_rls`.  
Обзор — [`../README.md`](../README.md).  
**Как банить юзеров:** [`../BAN.md`](../BAN.md).
