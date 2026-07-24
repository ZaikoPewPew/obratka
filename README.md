# Обратка (obratka)

Продукт взаимного ревью портфолио дизайнеров: регистрация → онбординг → очередь ревью / подача URL → квиз → отчёт.

**Стек:** Vite, vanilla JS, Supabase (Auth + Postgres + Edge Function), i18n `ru`/`en`.  
**Деплой:** GitHub Pages — https://zaikopewpew.github.io/obratka/  
**Репозиторий:** https://github.com/ZaikoPewPew/obratka

Карта экранов и URL: [`SCREENS.md`](SCREENS.md).

## Быстрый старт

```bash
npm install
cp .env.example .env   # заполнить SUPABASE_* и TELEGRAM_BOT_ID
npm run dev
```

Обычно `http://localhost:5173` → `/referral` (или `/home` / `/onboarding`, если есть сессия).

| Path | Экран |
|------|--------|
| `/referral` | Invite-only: валидный код → auth (seed `YTHWKPDWAK`) |
| `/registration` | Email → code / Telegram / Google |
| `/registration/code` | Код из письма (6 ячеек) |
| `/onboarding` | Вопросы профиля |
| `/home` | Очередь + баланс; аватар → свой реферальный код |
| `/portfolio` | Подача своего URL |
| `/review` | Просмотр портфолио + таймер |
| `/quiz` → `/quiz/done` | Квиз и финал |
| `/done` | Успех подачи (deep link / sync) |

### Переменные окружения

`.env` / `.env.local` (в `.gitignore`). Подробности: [`STRUCTURE.md`](STRUCTURE.md), [`.env.example`](.env.example).

| Переменная | Назначение |
|------------|------------|
| `SUPABASE_URL` | URL проекта Supabase |
| `SUPABASE_ANON_KEY` | публичный anon key |
| `TELEGRAM_BOT_ID` | число до `:` в токене BotFather (Login Widget) |
| `TELEGRAM_BOT_USERNAME` | username бота (опционально) |
| `VITE_BASE_PATH` | base для GitHub Pages (CI: `/obratka/`) |

**Не в клиентском `.env`:**

- Google Client ID/Secret — только Supabase Dashboard → Auth → Google  
- `TELEGRAM_BOT_TOKEN` — только Edge Function secrets  
- Email OTP — Dashboard → Auth → Providers → Email (включить OTP)

См. [`src/components/auth-screen/README.md`](src/components/auth-screen/README.md).

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Разработка (Vite HMR) |
| `npm run build` | `dist/` + `404.html` (SPA-fallback для Pages) |
| `npm run preview` | Просмотр production-сборки |
| `npm test` | Юнит-тесты (embed, meta, routes, referral code) |

## Auth

| Провайдер | Как |
|-----------|-----|
| **Email OTP** | код на почту → `/registration/code` → `verifyOtp`; resend с клиентским cooldown 60s |
| **Telegram** | Login Widget → Edge Function `telegram-auth` |
| **Google** | OAuth PKCE → redirect → `completeOAuthFromUrl` |

Сессия приложения: `localStorage` `obratka.session` + JWT Supabase Auth.  
**Email ↔ Google:** Automatic linking в Supabase (одна verified email = один user). Telegram (`tg{id}@t.me`) не склеивается.  
Ошибки identity / rate-limit мапятся в `auth.js` → i18n (`authIdentityConflict`, `authOtpRateLimit`).  
**Рефералы:** validate до auth / redeem после логина; 1 код на юзера, лимит 2; без наград. Seed: `YTHWKPDWAK`. См. [`supabase/sql/referrals.sql`](supabase/sql/referrals.sql), [`src/api/referrals.js`](src/api/referrals.js).  
API: [`src/api/README.md`](src/api/README.md). Setup: [`auth-screen/README.md`](src/components/auth-screen/README.md).

## Документация

| Документ | Содержание |
|----------|------------|
| [`SCREENS.md`](SCREENS.md) | Экраны, URL, handoff, контракты, защита auth |
| [`PROJECT.md`](PROJECT.md) | Продукт, архитектура, бэкенд, roadmap |
| [`STRUCTURE.md`](STRUCTURE.md) | Папки и env |
| [`mobile.md`](mobile.md) | Мобильный UX продукта (+ архив waitlist) |
| [`src/app/README.md`](src/app/README.md) | Routes / router / flow / session |
| [`src/api/README.md`](src/api/README.md) | Auth, profiles, referrals, wallet, portfolios |
| [`src/components/auth-screen/README.md`](src/components/auth-screen/README.md) | Dashboard Auth + identity linking |
| [`src/components/auth-code-screen/README.md`](src/components/auth-code-screen/README.md) | OTP UI + resend cooldown |
| [`src/components/referral-screen/README.md`](src/components/referral-screen/README.md) | Invite gate + validate RPC |
| [`src/components/home-screen/README.md`](src/components/home-screen/README.md) | Лента, баланс, шаринг реферального кода |
| [`supabase/README.md`](supabase/README.md) | SQL и Edge Functions |
| [`supabase/BAN.md`](supabase/BAN.md) | Как банить пользователей (Table/SQL + шаблоны) |
| [`.cursor/README.md`](.cursor/README.md) | Карта для агента Cursor |

## Деплой

Статика в `dist/`. На GitHub Pages `404.html` = копия `index.html` для deep link’ов.  
`SUPABASE_*` и `TELEGRAM_*` нужны на этапе `npm run build` (CI).  
Remote только `ZaikoPewPew/obratka` — см. `.cursor/rules/git-remote.mdc`.
