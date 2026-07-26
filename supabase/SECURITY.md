# Безопасность БД: состояние и решения

Живой срез того, что уже закрыто на проде, что оставлено осознанно и что ждёт Pro-плана.
Инварианты и правила — в [`.cursor/rules/security.mdc`](../.cursor/rules/security.mdc); порядок apply — в [`sql/README.md`](sql/README.md).

Проект: `xshfpkefdvhmrwrhhuoo` (Postgres 17, `ap-northeast-2`).

---

## Матрица доступа к RPC

Проверено `has_function_privilege` после миграций от 2026-07-26.

| Функция | `anon` | `authenticated` | Почему |
|---|---|---|---|
| `validate_referral(text)` | да | да | invite gate работает **до** логина |
| `claim_portfolio_review(uuid)` | нет | да | claim слота |
| `heartbeat_portfolio_claim(uuid)` | нет | да | TTL 20 min |
| `release_portfolio_claim(uuid)` | нет | да | уход без submit |
| `portfolio_reviewer_slots(uuid[])` | нет | да | слоты на карточках home |
| `can_review_portfolio(uuid, uuid)` | нет | да | лиги |
| `can_review_grades(text, text)` | нет | да | лиги |
| `grade_league(text)` | нет | да | лиги |
| `is_profile_banned(uuid)` | нет | да | self-only |
| `redeem_referral(text)` | нет | да | один раз на аккаунт |
| `spend_submit_cost()` | нет | да | списание за подачу |
| `submit_review_complaint(uuid, text[])` | нет | да | жалоба на лист |
| `handle_new_user()` | нет | **нет** | trigger-only, не через PostgREST |
| `profile_grade(uuid)` | нет | нет | оракул грейдов, только internal |
| `purge_expired_review_claims()` | нет | нет | internal |
| `handle_review_inserted()` | нет | нет | trigger-only |
| `review_complaint_tag_weight(text)` / `review_complaint_ban_threshold()` | нет | нет | веса жалоб не наружу |

Важно: Postgres по умолчанию даёт `EXECUTE` роли `PUBLIC`, а `anon` её наследует. Поэтому у каждой новой функции нужен явный `revoke ... from public` **и** `from anon`, иначе она автоматически появится в `/rest/v1/rpc/...` для незалогиненных.

Проверка текущего состояния:

```sql
select
  p.proname,
  pg_get_function_identity_arguments(p.oid) as args,
  has_function_privilege('anon', p.oid, 'EXECUTE') as anon_exec,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') as auth_exec
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef
order by 1;
```

---

## Таблицы

| Таблица | Клиент | Комментарий |
|---|---|---|
| `profiles` | select/update своих | `banned_at`, `ban_reason`, `tier`, `balance`, `reputation` режут триггеры `protect_profiles_*`; grade — только до `onboarding_done` |
| `portfolios` / `reviews` | по RLS (лиги, own) | `anon` отозван; INSERT review требует живой claim |
| `review_claims` | только `select` | mutations — исключительно через RPC |
| `review_complaints` | insert только RPC | `reporter_id` ревьюеру не виден |
| `referral_seed_codes` | нет доступа | seed `YTHWKPDWAK` только через RPC |
| `subscribers` | нет доступа | legacy waitlist |

---

## Баланс

Клиент **не может** начислять монеты:

- списание — `spend_submit_cost()`;
- награда за ревью (+1) — внутри `handle_review_inserted` через `set_config('app.bypass_profile_guards', ...)`;
- RPC `temp_credit_balance` **удалён** 2026-07-26 (был временный, позволял любому залогиненному накрутить себе баланс);
- клик по чипу баланса на home теперь DEV-only и пишет только в localStorage.

---

## Инцидент 2026-07-26: слоты ревьюеров

**Симптом.** Дашборд показывал 60% success rate и ~1565 ошибок Postgres за сутки при нулевых ошибках в других сервисах.

**Причина.** Версия `portfolio_reviewer_slots`, применённая ночью, читала `c.reviewer_grade` из `review_claims`, где такой колонки нет (грейд денормализован только в `reviews`). Клиент ловил ошибку RPC и уходил в fallback, который делал такой же `select` напрямую из `review_claims` — то есть на каждый poll home (~15 с) падало сразу два запроса.

**Решение.** Вместо добавления колонки закрепили продуктовое поведение: **активный слот анонимный**. Пока ревьюер не закончил, карточка показывает «слот занят», но не показывает кем; если он ушёл, не доревьюив, слот освобождается по TTL/release. В `active`-ветке RPC теперь `null::uuid` / `null::text`, и никакой грейд из claims больше не нужен.

После деплоя ошибок `reviewer_grade` в логах нет, `/rest/v1/rpc/portfolio_reviewer_slots` отдаёт 200.

UI-часть: [`src/components/home-screen/README.md`](../src/components/home-screen/README.md) (строка про `homeCardReviewerAnonymous`).

---

## Миграции этого раунда

| Версия | Имя | Что сделала |
|---|---|---|
| `20260726021140` | `portfolio_reviewer_slots_anonymous_active` | анонимные active-слоты, конец ошибок `reviewer_grade` |
| `20260726021218` | `revoke_anon_rpc_drop_temp_credit` | revoke anon/public на RPC; `drop function temp_credit_balance` |
| `20260726021238` | `revoke_league_helpers_public` | revoke на `grade_league` / `can_review_grades` |

Все три отражены в `sql/*.sql`, чтобы файлы оставались источником правды при чистом развёртывании.

---

## Осознанно оставлено

**`authenticated` может вызывать security definer RPC.** Линтер выдаёт WARN на `claim_portfolio_review`, `portfolio_reviewer_slots`, `spend_submit_cost` и остальные — это и есть публичный API приложения. Каждая функция сама проверяет `auth.uid()`, бан и лиги, поэтому предупреждение ожидаемо.

**`referral_seed_codes` с RLS без политик (INFO).** Так и задумано: ни одной политики означает ноль прямого доступа, работа только через `security definer` RPC.

**`validate_referral` доступна `anon` (WARN).** Без этого invite gate не сможет проверить код до логина.

---

## Отложено до Pro-плана

**Leaked Password Protection** (HaveIBeenPwned) — Dashboard → Authentication → Providers → Email → «Prevent use of leaked passwords».

На Free тогл не сохраняется:

```
Failed to update auth configuration: Configuring leaked password protection
via HaveIBeenPwned.org is available on Pro Plans and up.
```

Решение для MVP: оставить выключенным, включить при переходе на Pro. Адвайзор до тех пор будет висеть WARN.
Смежные настройки того же экрана, которые стоит пересмотреть вместе с апгрейдом: минимальная длина пароля сейчас 6, «Password requirements» не заданы, «Secure password change» выключен.

Docs: <https://supabase.com/docs/guides/auth/password-security>

---

## Регулярная проверка

1. `get_advisors` (security и performance) — особенно после любого DDL.
2. Логи Postgres: всплеск одинаковых `ERROR` почти всегда означает рассинхрон схемы и задеплоенного клиента, как в инциденте выше.
3. Запрос `has_function_privilege` из раздела про RPC — после добавления новых функций.

`permission denied for table profiles` и 401 на `/rest/v1/profiles` без сессии — норма: `anon` к `profiles` доступа не имеет.
