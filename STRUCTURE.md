# Структура проекта Обратка

Что где лежит и зачем. Карта экранов: [`SCREENS.md`](SCREENS.md). Продукт: [`PROJECT.md`](PROJECT.md).

## Корень

| Файл | Роль |
|------|------|
| `README.md` | Быстрый старт, env, auth, ссылки |
| `PROJECT.md` | Продукт, архитектура, бэкенд, roadmap |
| `SCREENS.md` | Экраны + path-роутинг + контракты фабрик |
| `STRUCTURE.md` | Этот документ |
| `mobile.md` | Мобильный UX продукта + архив waitlist-спеки |
| `index.html` | Каркас `.iframe-shell` (`/review`) + CSS entry |
| `vite.config.js` | Vite, `VITE_BASE_PATH`, префиксы `VITE_` / `SUPABASE_` / `TELEGRAM_` |
| `package.json` | Скрипты (`build` → ещё `404.html` для SPA) |
| `.env.example` | Шаблон клиентских env |

## Секреты (не в git)

`.env` / `.env.local` — см. таблицу ниже. Проверка: `git check-ignore -v .env`.

| Файл | В git? |
|------|--------|
| `.gitignore` | да |
| `.env`, `.env*.local` | нет |
| `dist/`, `node_modules/` | нет |

### Переменные клиента

| Переменная | Назначение |
|------------|------------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Auth, profiles, referrals, portfolios, review_complaints RPC, (legacy) subscribers |
| `TELEGRAM_BOT_ID` / `TELEGRAM_BOT_USERNAME` | Telegram Login Widget (публичные) |
| `VITE_BASE_PATH` | base для GitHub Pages (`/obratka/`) |

### Только Dashboard / Edge

| Что | Где |
|-----|-----|
| Google Client ID/Secret | Supabase Auth → Providers → Google |
| Email OTP | Supabase Auth → Providers → Email |
| `TELEGRAM_BOT_TOKEN` | Edge Function secrets (`telegram-auth`) |
| Redirect URLs | `http://localhost:5173/`, `https://zaikopewpew.github.io/obratka/` |

См. `.env.example` и `src/components/auth-screen/README.md`.

## Папки

| Папка | Роль |
|-------|------|
| `src/` | Код: `main.js`, `app/`, `components/`, `utils/`, `api/`, `lib/`, `assets/` |
| `styles/` | Токены + UI. Entry: tokens/base/entrance/iframe-shell/home/success/ban/report. Legacy waitlist CSS не в `index.html` |
| `content/` | `locales.json`, onboarding, embed-hosts, privacy, founder-avatars |
| `public/` | Статика по URL (favicon и т.п.) |
| `supabase/` | SQL (`profiles`, `referrals`, `portfolios`, `review_claims`, `review_complaints`, …) + Edge `telegram-auth` |
| `.cursor/` | Правила агента (`rules/*.mdc`) и карта (`.cursor/README.md`) |

### Brand UI (кратко)

| Модуль | Документ |
|--------|----------|
| Правый visual | [`src/components/brand-screen-visual/README.md`](src/components/brand-screen-visual/README.md) |
| Split-каркас | [`src/components/brand-screen-shell/README.md`](src/components/brand-screen-shell/README.md) |
| Ошибки полей | [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) |
| Марки / morph | [`src/assets/README.md`](src/assets/README.md) |

## Экраны и URL (кратко)

Полная таблица — [`SCREENS.md`](SCREENS.md) и [`src/app/README.md`](src/app/README.md).

```text
/referral → /registration → /onboarding → /home
  → /portfolio | /review → /quiz → /quiz/done
  → /report (Мои) | /done | /banned
```

`/referral` — invite-only gate (`validate_referral`); после входа у юзера свой код (лимит 2), шаринг с home.  
`/review` = просмотр портфолио + таймер.  
`/quiz` = опрос. Не путать с login-`session.js` (`obratka.session`).  
`/report` = листы ревью автора + жалоба → `reputation`.  
`/banned` = бан (в т.ч. автобан по репутации).

## Auth (кратко)

| Провайдер | Модуль |
|-----------|--------|
| Email OTP | `src/api/auth.js` (`requestEmailOtp` / `verifyEmailOtp`) + `auth-code-screen` |
| Telegram | `auth.js` + `telegramWidget.js` + `supabase/functions/telegram-auth/` |
| Google | `signInWithGoogle` / `completeOAuthFromUrl` |
| Ошибки Auth | `mapSupabaseAuthErrorCode` → UI (`authIdentityConflict`, rate-limit, …) |

**Защита:** Automatic linking Email↔Google (Dashboard/GoTrue); cooldown resend OTP (`--auth-code-resend-cooldown`); Telegram изолирован.  
Подробно: [`auth-screen/README.md`](src/components/auth-screen/README.md), [`PROJECT.md`](PROJECT.md) § Auth.

## Комментарии в JSON

Пояснения к `content/*.json` — соседние `*.md` и [`content/README.md`](content/README.md).
