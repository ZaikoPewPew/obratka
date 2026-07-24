# Cursor — проект «Обратка»

Краткая карта для агента. Продукт: [`PROJECT.md`](../PROJECT.md). Экраны: [`SCREENS.md`](../SCREENS.md). Структура: [`STRUCTURE.md`](../STRUCTURE.md).

## Правила (`.cursor/rules/`)

| Файл | О чём |
|------|--------|
| `design-tokens.mdc` | Только `var(--…)` из `tokens.css`, Montserrat, motion |
| `i18n.mdc` | UI-строки только из `locales.json` (ru/en) |
| `screens.mdc` | Экран = модуль, `go()`, paths, handoff, legacy off |
| `brand-ui.mdc` | Visual variants, field errors, marks — не копипастить mesh |
| `review-claims.mdc` | Claim / heartbeat / release; награда только после submit |
| `leagues.mdc` | Тихий матчинг по `profiles.grade` |
| `referrals.mdc` | Invite-only: validate → redeem, 2 слота, без наград |
| `ban.mdc` | Escape-proof `/banned`, операторский / автобан |
| `reputation.mdc` | Жалобы на листы → репутация → автобан |
| `supabase-sql.mdc` | Порядок SQL, RPC, RLS (glob `supabase/**`) |
| `security.mdc` | Секреты, RLS, клиент: anon ок; `service_role` никогда |
| `git-remote.mdc` | Remote / Pages только `ZaikoPewPew/obratka` |

## Дизайн-система

| Что | Где |
|-----|-----|
| Токены | `styles/tokens.css` |
| Локали | `content/locales.json`, `src/i18n.js` |
| Motion | `--motion-*`, `entrance.css`, `motionTokens.js`, `brandScreenTransition.js` |
| Field errors | `src/utils/FIELD_ERROR.md`, `fieldError.js`, `urlScreenField.js` |
| Brand visual / variants | `src/components/brand-screen-visual/` |
| Brand split-shell | `src/components/brand-screen-shell/` |
| Brand marks / morph | `src/assets/brand/brandMarks.js` |
| Шрифт | `@fontsource/montserrat` → `src/main.js` |

## Экраны и URL

Источник правды: [`SCREENS.md`](../SCREENS.md).

| Path | Экран |
|------|--------|
| `/referral` | Invite-only код (`validate_referral`; seed `YTHWKPDWAK`) |
| `/registration` | Email → `/registration/code` / Telegram / Google |
| `/registration/code` | 6 ячеек OTP |
| `/onboarding` | Онбординг → `profiles` |
| `/home` | Hub: лента (лиги) + мои + шаринг кода |
| `/portfolio` | Подача URL; done через `setVariant("done")` |
| `/review` | iframe + таймер (**нужен claim**) |
| `/quiz` | Квиз |
| `/quiz/done` | Финал квиза |
| `/done` | Запасной success (deep link) |
| `/report` | Листы ревью автора + жалоба → репутация |
| `/banned` | Аккаунт заблокирован (escape-proof; в т.ч. автобан) |

| Что | Где |
|-----|-----|
| Routes / router / flow | `src/app/` |
| Оркестрация | `main.js` → `go()` / `applyRoute()` / `syncRoute()` |
| Screens | `src/components/*-screen/` |
| Квиз | `review-screen/` + `review-panel/` |
| Онбординг-контент | `content/onboarding.json`, `content/onboarding.md` |

Entry CSS: `tokens`, `base`, `entrance`, `iframe-shell`, `home-screen`, `success-screen`, `ban-screen`, `report-screen`.

**Не восстанавливать** waitlist dual-layout (`apply-card`, `desktop.css` / `mobile.css`) без явной задачи.

## Review claims (шпаргалка)

1. Home pick → `claimPortfolioReview` → `/review`.
2. Heartbeat пока на review/quiz (TTL 20 min).
3. Abort / back / pagehide → `release` **без** монет.
4. Награда только после `submitPortfolioReview` → `awardReviewReward`.
5. SQL: `supabase/sql/review_claims.sql`; API: `src/api/portfolios.js`.

## Referrals (шпаргалка)

Validate **до** auth → redeem **после** login; 1 код / 2 слота; seed `YTHWKPDWAK`; **без наград**; шаринг с home (аватар).  
SQL / API: `supabase/sql/referrals.sql`, `src/api/referrals.js`.

## Ban (шпаргалка)

`profiles.banned_at` → `/banned`. Клиент не пишет ban/tier/reputation. UI: статичный `banBrandMarkSvg`, не `setVariant("invalid")`.  
Автобан: жалобы на листы → `reputation` → порог. Оператор: [`supabase/BAN.md`](../supabase/BAN.md).  
Жалобы: `reputation.mdc`, `supabase/sql/review_complaints.sql`, `src/api/reviewComplaints.js`.

## Auth (шпаргалка)

| Провайдер | Не делать |
|-----------|-----------|
| Email OTP | password-форму; спам resend без cooldown |
| Telegram | дублировать verify вне Edge Function |
| Google | класть Client Secret в клиентский `.env` |

| Защита | Где |
|--------|-----|
| Automatic linking Email↔Google | Supabase Auth; чеклист — `auth-screen/README.md` |
| Resend cooldown 60s | `--auth-code-resend-cooldown` + `auth-code-screen` |
| Identity conflict / rate-limit | `mapSupabaseAuthErrorCode` |
| Manual `linkIdentity` | **не** строить — `PROJECT.md` roadmap #4 |

API: `src/api/auth.js`. Edge: `supabase/functions/telegram-auth/`.

## Security (шпаргалка)

- **Anon ок** в клиенте / `.env.production` / Pages; защита = **RLS**, не секретность ключа.
- **`service_role` / `TELEGRAM_BOT_TOKEN` / Google Client Secret** — никогда в клиент, git или чат.
- Клиент только через `src/lib/supabaseClient.js` (anon).
- **Balance** — только RPC `spend_submit_cost` / award в review trigger; не client UPDATE.
- Подробно — `security.mdc`.

## Supabase SQL map

| Файл | Роль |
|------|------|
| `profiles.sql` | профиль, ban, reputation, tier, referral-колонки |
| `referrals.sql` | validate / redeem / seed |
| `portfolios.sql` | очередь + лиги |
| `review_claims.sql` | claim-слоты (после portfolios) |
| `review_complaints.sql` | жалобы на листы → reputation → автобан |
| `ban-templates.sql` | операторский бан |

Порядок и паттерны — `supabase-sql.mdc`.

## Brand UI (шпаргалка)

Эталон split: `url-screen` + `brand-screen-visual`.  
Ошибки: `setUrlScreenFieldInvalid` / `setUrlScreenOtpInvalid` **и** `setVariant("invalid")`.  
Variants: `default` / `invalid` (без resize) / `done`. Handoff: `go(id, { handoff: true })`.  
Подробно — `brand-ui.mdc`.

## Темы и языки

- Тема: `<html data-theme="dark">` (семантика в `tokens.css`)
- Язык: `?lang=en` / кнопка RU↔EN; default `ru`

## Wallet (кратко)

`REVIEW_REWARD` / `SUBMIT_COST` stub в `src/api/wallet.js`.  
Баланс: `profiles.balance` ↔ `session.balance`. Награда ревью — только после submit (см. claims).

## Исследования

| Что | Где |
|-----|-----|
| Опрос: дизайнеры и портфолио (2026) | `.cursor/research/designers-portfolio-2026.md` |
| Опросы: дизайн овчарка | `.cursor/research/design-ovcharka-polls.md` |
| Каталог встраивания площадок | `content/embed-hosts.md` |
