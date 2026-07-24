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
| Home: очередь по лигам `portfolios` / `reviews`, баланс | wired |
| Review iframe + таймер + квиз | wired |
| Подача URL + done на url-screen | wired |
| Referrals validate/redeem | wired (1 код / 2 слота, seed `YTHWKPDWAK`, без наград) |
| Legacy waitlist UI | код есть, **не смонтирован** из `main.js` / `index.html` |

## Продуктовый флоу

```text
/referral → /registration → /onboarding → /home
                              ├─ pick → /review → /quiz → /quiz/done
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
| `public.profiles` | 1:1 с user; онбординг, баланс, tier, `referral_code` (лимит 2); триггер `handle_new_user` |
| `public.referral_seed_codes` | bootstrap-коды (seed `YTHWKPDWAK`); только через RPC |
| `public.portfolios` / reviews | очередь ревью с матчингом по лиге грейда |
| `public.subscribers` | legacy waitlist API (`subscribers.js`), не entry UX |
| Edge `telegram-auth` | проверка Telegram hash → сессия |

SQL: [`supabase/sql/`](supabase/sql/), обзор [`supabase/README.md`](supabase/README.md).  
Бан юзеров (оператор): [`supabase/BAN.md`](supabase/BAN.md).

## Слои UI

| Слой | Где |
|------|-----|
| Brand split (referral / auth / onboarding / url) | `.url-screen*`, эталон `url-screen`; цель — `brand-screen-shell` |
| Home | `home-screen` + `home-screen.css` (лента, не split) |
| Review | `index.html` `.iframe-shell` + таймер в `main.js` |
| Quiz | `review-screen` + `review-panel` |
| Success | `success-screen` (`/done`) |

Handoff соседних brand-экранов: `go(id, { handoff: true })` — правый visual без повторной анимации.

## Дизайн и i18n

- Токены: `styles/tokens.css` (правило `.cursor/rules/design-tokens.mdc`).  
  В компонентах только `var(--…)`, шрифт Montserrat.
- Motion: `--motion-*`, `entrance.css`, `src/utils/motionTokens.js`.
- Строки: `content/locales.json` + `src/i18n.js` (правило `.cursor/rules/i18n.mdc`).
- Тема: `<html data-theme="dark">` (семантика в токенах).

## Entrypoint vs legacy waitlist

**Сейчас подключено** (`index.html` + `main.js`):

- CSS: `tokens`, `base`, `entrance`, `iframe-shell`, `success-screen`, `home-screen`
- Экраны: referral, auth, onboarding, home, url, review-shell, review/quiz, success

**Legacy (не entry):** `apply-card`, `email-field`, `desktop.css` / `mobile.css` / `apply.css`, waitlist-хелперы в `i18n.js` (`@deprecated`).  
Спека старого мобильного waitlist — раздел «Архив» в [`mobile.md`](mobile.md).

## Env (кратко)

| Где | Что |
|-----|-----|
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TELEGRAM_BOT_ID` (+ optional username), `VITE_BASE_PATH` |
| Dashboard Auth | Email OTP, Google OAuth, Redirect URLs |
| Edge secrets | `TELEGRAM_BOT_TOKEN` |

## Roadmap (код)

1. Вынести общие split-стили в `brand-screen.css` / довести `brand-screen-shell`.
2. Агрегация оценок нескольких ревьюеров в PDF-отчёте.
3. Manual identity linking UI (`linkIdentity`) + UNIQUE `profiles.email` + склейка Telegram↔email — вне текущего скоупа.  
   Email↔Google закрывается **Automatic linking** в Supabase Auth (verified email = один user); см. [`auth-screen/README.md`](src/components/auth-screen/README.md).

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
