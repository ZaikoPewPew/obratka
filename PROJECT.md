# Обратка — продукт и архитектура

Взаимное ревью портфолио: пользователь регистрируется, проходит онбординг, смотрит чужие работы (таймер + квиз) и/или подаёт свой URL в общую очередь.

**Стек:** Vite + vanilla JS, Supabase Auth / Postgres / Edge Function, i18n из `content/locales.json`, дизайн-токены в `styles/tokens.css`.

Карта экранов: [`SCREENS.md`](SCREENS.md). Структура папок: [`STRUCTURE.md`](STRUCTURE.md).

## Состояние (кратко)

| Область | Статус |
|---------|--------|
| Path-роутинг + entry по сессии | wired |
| Auth: Email OTP, Telegram, Google | wired → `auth.users` + `profiles` |
| Онбординг → `profiles` | wired |
| Home: очередь по лигам `portfolios` / `reviews`, баланс, репутация | wired |
| Review iframe + таймер + квиз | wired |
| Подача URL + done на url-screen | wired |
| Report: листы + жалоба → репутация / автобан | wired |
| Referrals validate/redeem | wired (1 код / 2 слота, seed `YTHWKPDWAK`, без наград) |
| Legacy waitlist UI | код есть, **не смонтирован** из `main.js` / `index.html` |

## Продуктовый флоу

```text
/referral → /registration → /onboarding → /home
                              ├─ pick → /review → /quiz → /quiz/done
                              ├─ mine → /report (листы + жалоба)
                              └─ submit → /portfolio → done (URL sync /done)
```

Корень `/` → `resolveEntryScreen(getSession())` в `src/app/flow.js`.  
Оркестрация: `src/main.js` (`go` / `applyRoute` / `syncRoute`).

Подробная таблица path ↔ экран — [`SCREENS.md`](SCREENS.md).

## Auth

| Провайдер | Клиент | Бэкенд |
|-----------|--------|--------|
| **Email OTP** | `requestEmailOtp` → `/registration/code` → `verifyEmailOtp` | Supabase Auth Email (OTP в Dashboard) |
| **Telegram** | Login Widget → `signInWithTelegram` | Edge Function `telegram-auth` → `verifyOtp` |
| **Google** | `signInWithGoogle` (OAuth PKCE) | Callback URL → `completeOAuthFromUrl` в `main.js` |

После успеха провайдера: `applyProviderUser` → `fetchMyProfile` → `obratka.session` → `onboarding` или `home`.

### Защита при регистрации

| Что | Как |
|-----|-----|
| Дубли Email ↔ Google | **Automatic linking** Supabase Auth (из коробки): одна verified email → один `auth.users` |
| Telegram | Isolated synthetic email `tg{id}@t.me` — не пересекается с Email/Google |
| Spam resend OTP | Клиентский cooldown `--auth-code-resend-cooldown` (60s) на `auth-code-screen` |
| Rate limit Auth | `email_otp_rate_limit` → `authOtpRateLimit` |
| Identity conflict | `mapSupabaseAuthErrorCode` → `auth_identity_conflict` → `authIdentityConflict` |
| Busy-lock UI | На `/registration` нельзя жать второй провайдер, пока занят первый |

**Вне скоупа (roadmap #4):** Manual `linkIdentity` UI, UNIQUE `profiles.email`, склейка Telegram↔email.

Документация: [`auth-screen/README.md`](src/components/auth-screen/README.md), [`auth-code-screen/README.md`](src/components/auth-code-screen/README.md), [`src/api/README.md`](src/api/README.md).

## Рефералы (invite-only)

Без наград: код → вход → свой код → поделиться.

| Что | Детали |
|-----|--------|
| Gate | `/referral` → RPC `validate_referral` (anon) до auth |
| Redeem | после логина `redeem_referral` (один раз на аккаунт) |
| Код юзера | `profiles.referral_code`, max **2** активации |
| Seed | `YTHWKPDWAK` в `referral_seed_codes` (холодный старт) |
| Шаринг | home → аватар → копировать код / ссылку `?ref=` |
| SQL / API | [`supabase/sql/referrals.sql`](supabase/sql/referrals.sql), [`src/api/referrals.js`](src/api/referrals.js) |

## Данные (Supabase)

| Сущность | Файл / роль |
|----------|-------------|
| `auth.users` | Supabase Auth |
| `public.profiles` | 1:1 с user; онбординг, баланс, `reputation`, tier, ban, `referral_code` (лимит 2); триггер `handle_new_user` |
| `public.referral_seed_codes` | bootstrap-коды (seed `YTHWKPDWAK`); только через RPC |
| `public.portfolios` / `reviews` | очередь ревью с матчингом по лиге грейда |
| `public.review_complaints` | жалобы автора на лист → штраф `reputation` → автобан |
| `public.subscribers` | legacy waitlist API (`subscribers.js`), не entry UX |
| Edge `telegram-auth` | проверка Telegram hash → сессия |

SQL: [`supabase/sql/`](supabase/sql/), обзор [`supabase/README.md`](supabase/README.md).  
Бан / автобан по репутации: [`supabase/BAN.md`](supabase/BAN.md).

## Репутация и жалобы на листы

Цель: ловить халяву / спам / травлю / нецелевое, не превращая обиду на жёсткую критику в бан.

| Что | Детали |
|-----|--------|
| Где UI | `/report` — список листов; «Пожаловаться» → модалка тегов (мультивыбор). Без жалобы = ок |
| Теги v1 | `low_effort`, `spam`, `harassment`, `offensive`, `irrelevant` (веса только в SQL) |
| Штраф | одна жалоба = `max(weight(tag))`; старт `reputation = 100`; бан при `<= 0` |
| Ревьюер | чип репутации на home + explainer **без** таблицы весов |
| Апелляция | вручную («Связаться» на `/banned`) |
| SQL / API | [`review_complaints.sql`](supabase/sql/review_complaints.sql), [`reviewComplaints.js`](src/api/reviewComplaints.js) |

**Вне v1:** `misleading`, очередь модерации, троттлинг жалобщиков, влияние на лиги.

## Слои UI

| Слой | Где |
|------|-----|
| Brand split (referral / auth / auth-code / onboarding / url) | `.url-screen*` + [`brand-screen-visual`](src/components/brand-screen-visual/README.md); цель — `brand-screen-shell` |
| Field errors | [`FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) — текст + обводка; visual `invalid` |
| App modal | [`app-modal`](src/components/app-modal/README.md) — общий диалог (слот контента + primary/secondary); Figma Modal |
| Home | `home-screen` + `home-screen.css` (лента, не split) |
| Review | `index.html` `.iframe-shell` + таймер в `main.js` |
| Quiz | `review-screen` + `review-panel` |
| Success | `success-screen` (`/done`) |
| Ban | `ban-screen` — статичный красный mesh + `banBrandMarkSvg` |
| Report | `report-screen` — листы ревью + жалоба |
| Home | чип баланса + чип репутации (explainer) |

Handoff соседних brand-экранов: `go(id, { handoff: true })` — правый visual без повторной анимации.

Visual variants: `default` / `invalid` (рожки без resize) / `done` (logo-done). Подробно — README `brand-screen-visual`.

## Дизайн и i18n

- Токены: `styles/tokens.css` (правило `.cursor/rules/design-tokens.mdc`).  
  В компонентах только `var(--…)`, шрифт Montserrat.
- Motion: `--motion-*` (в т.ч. `--motion-field-error-*`, `--app-modal-*`), `entrance.css`, `src/utils/motionTokens.js`.
- Field errors: [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md).
- Brand visual: [`brand-screen-visual`](src/components/brand-screen-visual/README.md).
- App modal: [`app-modal`](src/components/app-modal/README.md).
- Строки: `content/locales.json` + `src/i18n.js` (правило `.cursor/rules/i18n.mdc`); close aria модалки — `modalCloseAria`.
- Тема: `<html data-theme="dark">` (семантика в токенах).

## Entrypoint vs legacy waitlist

**Сейчас подключено** (`index.html` + `main.js`):

- CSS: `tokens`, `base`, `entrance`, `app-modal`, `iframe-shell`, `success-screen`, `home-screen`, `ban-screen`, `report-screen`
- Экраны: referral, auth, auth-code, onboarding, home, url, review-shell, review/quiz, success, report, ban
- Shared UI: `brand-screen-visual`, `brand-screen-shell` (referral / auth / auth-code / onboarding / url), `app-modal`

Архив waitlist (`apply-card`, `email-field`, dual-layout CSS) удалён. Спека: раздел «Архив» в [`mobile.md`](mobile.md).

## Env (кратко)

| Где | Что |
|-----|-----|
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TELEGRAM_BOT_ID` (+ optional username), `VITE_BASE_PATH` |
| Dashboard Auth | Email OTP, Google OAuth, Redirect URLs |
| Edge secrets | `TELEGRAM_BOT_TOKEN` |

## Roadmap (код)

1. Вынести общие split-стили в `brand-screen.css` (классы пока `.url-screen*`).
2. Агрегация оценок нескольких ревьюеров в PDF-сводке на `report-screen` (жалобы на листы уже есть).
3. Manual identity linking UI (`linkIdentity`) + UNIQUE `profiles.email` + склейка Telegram↔email — вне текущего скоупа.  
   Email↔Google закрывается **Automatic linking** в Supabase Auth (verified email = один user); см. [`auth-screen/README.md`](src/components/auth-screen/README.md).
4. Троттлинг злоупотреблений жалобой / тег `misleading` / очередь модерации.

## Команды

```bash
npm install
npm run dev
npm run build
npm run preview
npm test
```

---

*Обновлять при смене флоу экранов, схемы Supabase, auth-провайдеров или процесса деплоя.*
