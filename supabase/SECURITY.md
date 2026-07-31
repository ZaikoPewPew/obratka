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
| `portfolio_reviewer_slots(uuid[])` | нет | да | слоты home; VOLATILE; в начале `purge_expired_review_claims` |
| `can_review_portfolio(uuid, uuid)` | нет | да | лиги |
| `can_review_grades(text, text)` | нет | да | лиги |
| `grade_league(text)` | нет | да | лиги |
| `is_profile_banned(uuid)` | нет | да | self-only |
| `redeem_referral(text)` | нет | да | один раз на аккаунт |
| `spend_submit_cost()` | нет | да | legacy списание; подача — `submit_portfolio` |
| `submit_portfolio(text,text,text,text)` | нет | да | atomic spend + insert, max 1 pending; reject non-http(s) URL (`invalid_url`) |
| `submit_review_complaint(uuid, text[])` | нет | да | жалоба на лист (1 тег, окно 6ч от done) |
| `settle_review_reputation_rewards()` | нет | да | lazy +10 за чистые ревью после окна (от completed_at) |
| `heartbeat_legendary_presence()` | нет | да | ping `last_seen_at` только для `tier=legendary` |
| `list_online_legendaries()` | нет | да | список онлайн VIP (id/name/avatar) |
| `legendary_presence_ttl()` | нет | нет | internal TTL 2 min |
| `list_rating_top()` | нет | да | топ-50 по reputation из снапшота (пересборка раз в 24 ч) |
| `rating_leaderboard_ttl()` | нет | нет | internal TTL 24 h |
| `refresh_rating_leaderboard()` | нет | нет | internal security definer, зовётся из `list_rating_top` |
| `protect_profiles_last_seen()` | нет | нет | trigger-only |
| `handle_new_user()` | нет | **нет** | trigger-only, не через PostgREST |
| `profile_grade(uuid)` | нет | нет | оракул грейдов, только internal |
| `purge_expired_review_claims()` | нет | нет | internal (claim / heartbeat / `portfolio_reviewer_slots`) |
| `handle_review_inserted()` | нет | нет | trigger-only |
| `review_complaint_tag_weight(text)` / `review_complaint_ban_threshold()` / `review_complaint_window()` / `review_reputation_*` | нет | нет | веса / порог / окно не наружу |

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
| `profiles` | select своих; UPDATE только product-колонок | column-level grant: `display_name`, `avatar_url`, `telegram_username`, `role`, `grade`, `workplace`, `domains`, `goals`, `onboarding`, `onboarding_done`. Триггеры `protect_profiles_*`: `banned_at`/`ban_reason`, `tier`, `balance`, `reputation`, `last_seen_at`, **grade после onboarding**, identity (`email`/`telegram_id`/`auth_provider`/`created_at`), запрет сброса `onboarding_done`. Role после онбординга можно менять из `/settings` (CHECK whitelist) |
| `portfolios` / `reviews` | по RLS (лиги, own); portfolios **без** client INSERT | insert портфолио только RPC `submit_portfolio`; INSERT review требует живой claim |
| `review_claims` | только `select` | mutations — исключительно через RPC |
| `review_complaints` | insert только RPC | `reporter_id` ревьюеру не виден |
| `referral_seed_codes` | нет доступа | seed `YTHWKPDWAK` только через RPC |
| `subscribers` | нет доступа | legacy waitlist |
| Storage `portfolio-previews` | select (публичный CDN, `public = true`) | insert/update/delete — только Edge `portfolio-preview` через `service_role`; политик на `storage.objects` нет — default-deny для anon/authenticated |

---

## Баланс

Клиент **не может** начислять монеты:

- подача портфолио — `submit_portfolio()` (atomic: лимит 1 pending + spend 30 + INSERT);
- legacy `spend_submit_cost()` без insert — не использовать с клиента (тоже 30);
- награда за ревью (+10) — внутри `handle_review_inserted` через `set_config('app.bypass_profile_guards', ...)`;
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
| *(MCP)* | `legendary_presence_last_seen` | `last_seen_at` + heartbeat/list для legendary online |
| *(MCP)* | `grade_league_null_as_league_1` | null/unknown grade → лига 1 (как junior) |
| *(MCP)* | `wrap_auth_uid_rls_initplan` | `auth.uid()` → `(select auth.uid())` в 6 RLS-политиках (`profiles_select_own`, `profiles_update_own`, `portfolios_select_feed`, `reviews_insert_own`, `review_claims_select_visible`, `reviews_select_reviewer_or_owner`, `review_complaints_select_own`) — снят `auth_rls_initplan` WARN, доступ не менялся |
| *(MCP)* | `portfolio_reviewer_slots_purge_expired` | `purge_expired_review_claims` в начале `portfolio_reviewer_slots` (expired anonymous не светятся до следующего claim) |
| *(MCP)* | `profiles_workplace_and_settings_constraints` | колонка `workplace` + CHECK на длину `display_name` / `workplace`, whitelist `role`, формат `telegram_username` (нужна для `/settings`; без неё `select` профиля → 400) |
| *(MCP)* | `profiles_identity_guard_and_column_grants` | `protect_profiles_grade` теперь режет только `grade` (role редактируется из `/settings`); новый `protect_profiles_identity` (`email` / `telegram_id` / `auth_provider` / `created_at` + запрет сброса `onboarding_done`); table-level UPDATE → column-level grant |

Отражены в `sql/*.sql`, чтобы файлы оставались источником правды при чистом развёртывании.

---

## Инцидент 2026-07-28: залипающие anonymous-слоты

**Симптом.** Уход с `/review` по новой ссылке / reload оставлял active-слот «Аноним»; несколько аккаунтов забивали 3/3; автор orphan снова входил через `own_live`.

**Причина.** `pagehide` слал обычный `supabase.rpc` без `keepalive` → браузер убивал запрос; `claimHeld` только in-memory → boot не релизил.

**Решение (клиент + SQL):**
- `releasePortfolioClaimKeepalive` + per-tab `sessionStorage` `obratka.reviewClaim` + reconcile в `releaseHeldClaim`;
- home gate `isPortfolioOpenForReview` до intro;
- SQL: purge expired в `portfolio_reviewer_slots` (миграция выше).

Apply SQL: [`sql/README.md`](sql/README.md) § «Как применять». Правила: [`.cursor/rules/review-claims.mdc`](../.cursor/rules/review-claims.mdc).

---

## Осознанно оставлено

**`authenticated` может вызывать security definer RPC.** Линтер выдаёт WARN на `claim_portfolio_review`, `portfolio_reviewer_slots`, `spend_submit_cost` и остальные — это и есть публичный API приложения. Каждая функция сама проверяет `auth.uid()`, бан и лиги, поэтому предупреждение ожидаемо.

**`referral_seed_codes` с RLS без политик (INFO).** Так и задумано: ни одной политики означает ноль прямого доступа, работа только через `security definer` RPC.

**`validate_referral` доступна `anon` (WARN).** Без этого invite gate не сможет проверить код до логина.

---

## Наплыв регистраций: custom SMTP (Free-план)

На Free-плане Email OTP (`signInWithOtp` → `/auth/v1/otp`) уходит через встроенный почтовый релей Supabase, у которого низкий и недокументированно жёсткий лимит писем без своего SMTP. При резком наплыве регистраций (сотни за короткое окно) это выглядит как «код не пришёл» массово.

**Также:** без custom SMTP Dashboard **не даёт править** Email Templates («Set up custom SMTP to edit templates»). Дефолтный Confirm sign up — только ссылка; для UI `/registration/code` нужен `{{ .Token }}` в **Magic link or OTP** и **Confirm sign up** — см. [`auth-screen/README.md`](../src/components/auth-screen/README.md).

**Проверить перед любым анонсом/ростом:**

1. Dashboard → **Authentication → Emails → SMTP Settings** — включён ли custom SMTP.
2. Если нет — завести аккаунт у провайдера (Resend / Postmark / SendGrid и т.п., бесплатных тиров на сотни писем/день обычно достаточно) и вписать креды в Dashboard. Это ручной шаг с реальными секретами провайдера — не делается через MCP/агента, только руками владельца проекта.
3. Dashboard → **Authentication → Rate Limits** → `Email OTP` — поднять лимит `/auth/v1/otp` (по умолчанию 360/час), если ожидается всплеск плотнее.
4. После подключения custom SMTP лимит писем перестаёт быть общим релеем Supabase — им управляет сам провайдер.

Пока custom SMTP не настроен — не рассчитывать на устойчивую доставку OTP при одновременной регистрации десятков+ пользователей.

## Наплыв регистраций: thum.io без ключа (превью карточек)

Анонимный (без ключа) тир thum.io имеет жёсткие лимиты запросов; при резком наплюве это давало массовые 429/битые превью по всей ленте.

**Решение (код):** Edge Function `portfolio-preview` (`supabase/functions/portfolio-preview/`) — кэш успешных скриншотов в Storage (`portfolio-previews`, 24 ч) + retry с бэкоффом на 429 + fallback на протухший кэш вместо ошибки. Клиент теперь ходит в неё (`portfolioPreviewUrl` в `src/api/portfolios.js`), а не напрямую в `image.thum.io`. Бакет самоочищается (без `pg_cron`) — вероятностный фоновый sweep удаляет объекты, не просматриваемые дольше 30 дней, так что размер бакета ограничен реально активными портфолио, а не растёт бесконечно.

**Опционально:** если появится платный ключ thum.io — `supabase secrets set THUMIO_AUTH_KEY=<key>`, код менять не нужно.

Подробности: [`functions/portfolio-preview/README.md`](functions/portfolio-preview/README.md).

## Наплыв регистраций: холодный старт ленты

Новый профиль стартует с `balance = 0`; `submit_portfolio` стоит 30, `handle_review_inserted` начисляет 10 за ревью — подать своё портфолио можно только после 3 чужих ревью. Стартовый бонус балансом сознательно **не** даём (риск нарушить экономику / фарм мультиаккаунтами — решение продукта 2026-07-26).

**План перед анонсом:** до наплыва закинуть в очередь несколько портфолио вручную с оператора аккаунтов (обычный флоу `submit_portfolio`, за реальные монеты оператора — не бесплатный кредит), чтобы у первых волн новых пользователей в ленте «На ревью» сразу было что ревьюить. Как только они заработают на первых ревью — начнут подавать свои, и очередь пойдёт органически.

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
