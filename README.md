# Обратка (obratka)

Продукт взаимного ревью портфолио дизайнеров: регистрация → онбординг → очередь ревью / подача URL → квиз → отчёт.

**Стек:** Vite, vanilla JS, Supabase (Auth + Postgres + Edge Function), i18n `ru`/`en`.  
**Деплой:** GitHub Pages — https://zaikopewpew.github.io/obratka/  
**Репозиторий:** https://github.com/ZaikoPewPew/obratka

Карта экранов и URL: [`SCREENS.md`](SCREENS.md). Аналитика: [`ANALYTICS.md`](ANALYTICS.md).  
**Desktop-only:** viewport &lt; 768px → заглушка — [`mobile.md`](mobile.md). Промо: [`landing/`](landing/README.md).

## Быстрый старт

```bash
npm install
cp .env.example .env   # заполнить SUPABASE_*, TELEGRAM_BOT_ID, VITE_POSTHOG_*
npm run dev
```

Обычно `http://localhost:5173` → `/referral` (или `/home` / `/onboarding`, если есть сессия).  
Лендос: [http://localhost:5173/landing/](http://localhost:5173/landing/).

| Path | Экран |
|------|--------|
| `/referral` | Invite-only: валидный код → auth (seed `YTHWKPDWAK`) |
| `/registration` | Email → code / Telegram / Google |
| `/registration/code` | Код из письма (6 ячеек) |
| `/onboarding` | Вопросы профиля |
| `/home` | Очередь / мои / рейтинг (топ-50 по репутации); SWR, report gate, точки feedSeen + 3/3, intro до claim, tabbar-dock + submit (glass / `--on-dark` / entrance cascade); вид синхронизирован с query |
| `/settings` | Профиль в side-panel (из account-menu) |
| `/portfolio` | Подача URL; чип «На главную»; done на том же экране |
| `/review` | Просмотр портфолио + таймер 60 s (iframe pause / external wall-clock) + звук конца + надиктовка (rec) |
| `/quiz` → `/quiz/done` | Квиз (visual 1–5, условный pain, рыночный `tier`, mic в совете) и финал — [`QUIZ.md`](QUIZ.md) |
| `/done` | Успех подачи (deep link / sync) |
| `/report` | Листы автору (+ заметки) + жалоба; сводный PDF + action cards — [`ACTION_CARDS.md`](ACTION_CARDS.md) |
| `/banned` | Аккаунт заблокирован (escape-proof; в т.ч. автобан по репутации) |
| `/landing/` | Промо (отдельный Vite entry, без session) |

### Переменные окружения

`.env` / `.env.local` (в `.gitignore`). Подробности: [`STRUCTURE.md`](STRUCTURE.md), [`.env.example`](.env.example).

| Переменная | Назначение |
|------------|------------|
| `SUPABASE_URL` | URL проекта Supabase |
| `SUPABASE_ANON_KEY` | публичный anon key |
| `TELEGRAM_BOT_ID` | число до `:` в токене BotFather (Login Widget) |
| `TELEGRAM_BOT_USERNAME` | username бота (опционально) |
| `VITE_BASE_PATH` | base для GitHub Pages (CI: `/obratka/`) |
| `VITE_POSTHOG_KEY` | PostHog project token (публичный) |
| `VITE_POSTHOG_HOST` | `https://us.i.posthog.com` или `https://eu.i.posthog.com` |

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
| `npm test` | Юнит-тесты (embed, meta, app/home routes, referral, reviewReport/dictation) |

## Auth

| Провайдер | Как |
|-----------|-----|
| **Email OTP** | код на почту → `/registration/code` → `verifyOtp`; resend с клиентским cooldown 60s |
| **Telegram** | Login Widget → Edge Function `telegram-auth` |
| **Google** | OAuth PKCE → redirect → `completeOAuthFromUrl` |

Сессия приложения: `localStorage` `obratka.session` + JWT Supabase Auth. `obratka.session` — только UX-кэш: на boot сохранённый `userId` сверяется с живым Supabase Auth; при отсутствии Auth кэш очищается, а referral-код сохраняется. Auth-gated deep link без логина возвращает в referral/auth, а незавершённый онбординг — в `/onboarding`.
**Email ↔ Google:** Automatic linking в Supabase (одна verified email = один user). Telegram (`tg{id}@t.me`) не склеивается.  
Ошибки identity / rate-limit мапятся в `auth.js` → i18n (`authIdentityConflict`, `authOtpRateLimit`).  
**Рефералы:** validate до auth / redeem после логина; 1 код на юзера, лимит 2; без наград. Seed: `YTHWKPDWAK`. См. [`supabase/sql/referrals.sql`](supabase/sql/referrals.sql), [`src/api/referrals.js`](src/api/referrals.js).  
**Репутация:** жалоба на лист в `/report` (ровно 1 тег, окно 6ч от `portfolios.completed_at`) → −20; старт `0`, бан при `<= -100`; +10 после окна без жалобы. См. [`supabase/BAN.md`](supabase/BAN.md), [`src/api/reviewComplaints.js`](src/api/reviewComplaints.js).  
API: [`src/api/README.md`](src/api/README.md). Setup: [`auth-screen/README.md`](src/components/auth-screen/README.md).

## Документация

| Документ | Содержание |
|----------|------------|
| [`SCREENS.md`](SCREENS.md) | Экраны, URL, handoff, visual variants, контракты |
| [`PROJECT.md`](PROJECT.md) | Продукт, архитектура, бэкенд, roadmap |
| [`STRUCTURE.md`](STRUCTURE.md) | Папки и env |
| [`ACTION_CARDS.md`](ACTION_CARDS.md) | Сводный PDF: majority → action cards + `actionResources` |
| [`ANALYTICS.md`](ANALYTICS.md) | PostHog: pageviews, воронки, чеклист новой фичи |
| [`RELEASE.md`](RELEASE.md) | Чеклист релиза v1: полиш, инфра, QA, go/no-go |
| [`mobile.md`](mobile.md) | **Desktop-only** (&lt;768px → заглушка) + архив waitlist |
| [`landing/README.md`](landing/README.md) | Промо-лендос (MPA entry, CTA → `/referral`) |
| [`src/components/desktop-only-screen/README.md`](src/components/desktop-only-screen/README.md) | Оверлей «только с компьютера» |
| [`src/app/README.md`](src/app/README.md) | Routes / router / flow / session |
| [`src/api/README.md`](src/api/README.md) | Auth, profiles, referrals, wallet, portfolios, reviewComplaints |
| [`src/components/brand-screen-visual/README.md`](src/components/brand-screen-visual/README.md) | Правый visual: `default` / `invalid` / `done` |
| [`src/components/brand-screen-shell/README.md`](src/components/brand-screen-shell/README.md) | Split-каркас brand-экранов |
| [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) | Ошибки полей (текст + обводка) |
| [`src/assets/README.md`](src/assets/README.md) | Brand marks / evil morph без resize |
| [`src/components/auth-screen/README.md`](src/components/auth-screen/README.md) | Dashboard Auth + identity linking |
| [`src/components/auth-code-screen/README.md`](src/components/auth-code-screen/README.md) | OTP UI + resend cooldown |
| [`src/components/referral-screen/README.md`](src/components/referral-screen/README.md) | Invite gate + validate RPC |
| [`src/components/home-screen/README.md`](src/components/home-screen/README.md) | Лента/мои/рейтинг, URL-query, SWR, review intro, mine report gate, feedSeen + 3/3, legendary aside, tabbar-dock + submit, entrance cascade |
| [`QUIZ.md`](QUIZ.md) | Пул вопросов квиза, схема answers, трактовки PDF |
| [`src/components/review-panel/README.md`](src/components/review-panel/README.md) | Шаги квиза + conditional pain + tier + done |
| [`src/components/scale-slider/README.md`](src/components/scale-slider/README.md) | Шкалы context/visual 1–5 (canvas, ступени, приписки) |
| [`src/components/url-screen/README.md`](src/components/url-screen/README.md) | Подача URL: back-chip + done |
| [`src/components/report-screen/README.md`](src/components/report-screen/README.md) | Листы ревью + жалоба |
| [`src/config/README.md`](src/config/README.md) | `REVIEW_SESSION_SECONDS`, contacts |
| [`src/lib/dictation/README.md`](src/lib/dictation/README.md) | Надиктовка: `/review` → `answers.dictation` + mic в совете; post-edit → [`polish-dictation`](supabase/functions/polish-dictation/README.md) (сейчас клиент off) |
| [`supabase/functions/polish-dictation/README.md`](supabase/functions/polish-dictation/README.md) | Edge post-edit пунктуации (Z.AI `glm-4.5-flash` + fallback; soft-fail → сырой текст; `ZAI_API_KEY`; **`POLISH_ENABLED = false`**) |
| [`supabase/README.md`](supabase/README.md) | SQL и Edge Functions |
| [`supabase/BAN.md`](supabase/BAN.md) | Бан / автобан по репутации (Table/SQL + шаблоны) |
| [`.cursor/README.md`](.cursor/README.md) | Карта для агента Cursor |

## Деплой

Статика в `dist/` (`index.html` + `landing/index.html`). На GitHub Pages `404.html` = копия `index.html` для SPA deep link’ов.  
Prod: https://zaikopewpew.github.io/obratka/ · лендос: https://zaikopewpew.github.io/obratka/landing/  
`SUPABASE_*` и `TELEGRAM_*` нужны на этапе `npm run build` (CI).  
Remote только `ZaikoPewPew/obratka` — см. `.cursor/rules/git-remote.mdc`.
