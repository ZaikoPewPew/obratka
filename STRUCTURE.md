# Структура проекта Обратка

Что где лежит и зачем. Карта экранов: [`SCREENS.md`](SCREENS.md). Продукт: [`PROJECT.md`](PROJECT.md).

## Корень

| Файл | Роль |
|------|------|
| `README.md` | Быстрый старт, env, auth, ссылки |
| `PROJECT.md` | Продукт, архитектура, бэкенд, roadmap |
| `ANALYTICS.md` | PostHog: фасад, pageviews, воронки, чеклист новой фичи |
| `SCREENS.md` | Экраны + path-роутинг + контракты фабрик |
| `QUIZ.md` | Пул вопросов квиза, схема `answers`, L1/L2/L3 PDF-отчёта |
| `STRUCTURE.md` | Этот документ |
| `ACTION_CARDS.md` | Сводный PDF: majority → action cards + resources |
| `ANALYTICS.md` | PostHog: фасад, pageviews, воронки |
| `mobile.md` | **Desktop-only** гейт (&lt;768px) + архив waitlist / старого adaptive QA |
| `index.html` | Каркас `.iframe-shell` (`/review`) + CSS entry |
| `landing/` | Промо-лендос (отдельный Vite entry, без api/session) — [`landing/README.md`](landing/README.md) |
| `vite.config.js` | Vite, MPA (`index` + `landing`), `VITE_BASE_PATH`, `envPrefix: VITE_*` + allowlist `SUPABASE_URL`/`ANON_KEY`/`TELEGRAM_BOT_*` через `define`; `%SITE_ORIGIN%` / `%SITE_BASE%` → absolute OG/canonical |
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
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | Auth, profiles, referrals, portfolios, review_complaints RPC |
| `TELEGRAM_BOT_ID` / `TELEGRAM_BOT_USERNAME` | Telegram Login Widget (публичные) |
| `VITE_BASE_PATH` | Vite `base` (CI prod: `/` для `obratka.net`) |
| `VITE_POSTHOG_KEY` / `VITE_POSTHOG_HOST` | PostHog project token + host (`us` / `eu`); без key — analytics no-op |

### Только Dashboard / Edge

| Что | Где |
|-----|-----|
| Google Client ID/Secret | Supabase Auth → Providers → Google |
| Email OTP | Supabase Auth → Providers → Email (UI сейчас off — `EMAIL_AUTH_ENABLED`) |
| `TELEGRAM_BOT_TOKEN` | Edge Function secrets (`telegram-auth`) |
| `ZAI_API_KEY` (опц. `ZAI_MODEL`, `ZAI_MODEL_FALLBACK`) | Edge Function secrets (`polish-dictation`; default `glm-4.5-flash`; клиентский invoke сейчас off — `POLISH_ENABLED`) |
| Redirect URLs | `http://localhost:5173/`, `https://obratka.net/` |

См. `.env.example` и `src/components/auth-screen/README.md`.

## Папки

| Папка | Роль |
|-------|------|
| `src/` | Код: `main.js`, `app/`, `components/` (в т.ч. `desktop-only-screen`), `utils/` (`viewport.js`, consensus/action cards), `data/` (`actionCards.json` + `actionResources.json`), `api/`, `config/` ([README](src/config/README.md)), `lib/` ([README](src/lib/README.md): supabase + **analytics** + **dictation**), `assets/` |
| `styles/` | Токены + UI. Entry: tokens/base/entrance/app-modal/iframe-shell/home/…; `desktop-only-screen.css` — импорт из фабрики; лендос — `landing/styles/landing.css` + `--landing-*` |
| `content/` | `locales.json`, onboarding, embed-hosts, founder-avatars, rules |
| `public/` | Статика по URL: favicon, OG (`assets/og/`), `robots.txt`, `sitemap.xml` (лендос); см. [`public/README.md`](public/README.md) |
| `supabase/` | SQL (`profiles`, `legendary_presence`, `rating_leaderboard`, `wallet`, `portfolios`, `portfolio_submit`, `review_claims`, `review_complaints`, `referrals`, …) + Edge (`telegram-auth`, `portfolio-preview`, `portfolio-embed-probe`, `polish-dictation`); доступы — `SECURITY.md` |
| `.cursor/` | Правила агента (`rules/*.mdc`) и карта (`.cursor/README.md`) |

### Brand UI (кратко)

| Модуль | Документ |
|--------|----------|
| Правый visual | [`src/components/brand-screen-visual/README.md`](src/components/brand-screen-visual/README.md) |
| Split-каркас | [`src/components/brand-screen-shell/README.md`](src/components/brand-screen-shell/README.md) |
| App modal | [`src/components/app-modal/README.md`](src/components/app-modal/README.md) |
| Tabs panel | [`src/components/tabs-panel/README.md`](src/components/tabs-panel/README.md) |
| Scale slider (квиз 1–5) | [`src/components/scale-slider/README.md`](src/components/scale-slider/README.md) — nearest + hover-превью |
| Desktop-only gate | [`src/components/desktop-only-screen/README.md`](src/components/desktop-only-screen/README.md) · [`mobile.md`](mobile.md) |
| Landing (промо) | [`landing/README.md`](landing/README.md) |
| Action cards / сводный PDF | [`ACTION_CARDS.md`](ACTION_CARDS.md) |
| Квиз / отчёт (SoT) | [`QUIZ.md`](QUIZ.md) |
| Ошибки полей | [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) |
| Марки / morph | [`src/assets/README.md`](src/assets/README.md) |

## Экраны и URL (кратко)

Полная таблица — [`SCREENS.md`](SCREENS.md) и [`src/app/README.md`](src/app/README.md).

```text
/referral → /registration → /onboarding → /home
  → pick → intro → claim → /review → /quiz → /quiz/done
  → mine → gate → /report | /portfolio → /done | /banned
```

`/referral` — invite-only gate (`validate_referral`); после входа у юзера свой код (лимит 2), шаринг с home (copy + Telegram / X / Threads / LinkedIn).  
`/home` — feed/mine (рейтинг UI off, `RATING_TAB_ENABLED = false`; `?tab=rating` → feed); активный вид хранится в query через `homeRoute` (`?filter=completed` на feed и mine); SWR-кэш `homeListCache` (`feed`/`feedReviewed`/`mine`/`rating`); aside «Топы в сети»; FAB feedback (`feedback`). Intro до claim; отправленный отчёт → сегмент «Уже отревьюено» (`listReviewedPortfolios`); mine report gate; сегменты Ждёт/Уже + Ещё/Завершенные (`tabs-panel`); free-slot «Ещё на ревью» до `MAX_MINE_PENDING` (=1); точка на «Чужие посты» (`feedSeen`); точка на «Мои» и «Завершенные» (`mineReadySeen`); tabbar-dock (glass tabs + «Закинуть своё») с контрастом над превью (`--on-dark`); на open/reload — entrance cascade (`--home-screen-reveal-delay-*`, dock = `motion-reveal-dock` без opacity).
`/portfolio` — подача URL; чип «На главную» (скрыт на done); done на том же экране.  
`/review` = просмотр портфолио + таймер **60 s** (`REVIEW_SESSION_SECONDS` в `src/config/review.js`) + опциональная надиктовка (чип rec → `answers.dictation`) + post-edit пунктуации (Edge `polish-dictation`; **клиент сейчас off** — `POLISH_ENABLED = false` в `dictationPolish.js`; soft-fail → сырой текст).  
iframe / external: каталог [`content/embed-hosts.md`](content/embed-hosts.md) (`embedHosts` / `portfolioEmbed` + Edge `portfolio-embed-probe` XFO/CSP; Readymag probe + frame-block → external UI).  
iframe: таймер паузится при уходе со вкладки; external: wall-clock без паузы, конец → `Timer-end.wav` + quiz.  
`/quiz` = опрос (`review-panel` + [`scale-slider`](src/components/scale-slider/README.md) на шагах понятность/визуал **1–5**; условный pain; рыночный `tier`); в поле «Главный совет» — микрофон (тот же polish-путь, сейчас off). Спека: [`QUIZ.md`](QUIZ.md). Не путать с login-`session.js` (`obratka.session`).  
`/report` = листы ревью автора (+ секция надиктовки) + жалоба (1 тег, окно 6ч от done) → reputation (старт 0 / бан −100 / +10 settle). Сводный PDF — majority + action cards из `actionCards`/`actionResources` ([`ACTION_CARDS.md`](ACTION_CARDS.md)). Вход только когда собраны все ревью.  
`/banned` = бан (в т.ч. автобан при `reputation <= -100`).  
`/404` = неизвестный path (`not-found-screen`); CTA → `/home` или `/registration`.  
`/landing/` = промо MPA (без api/session); «Войти» / «Попробовать» → `/referral` или `/registration` по invite gate; `?ref=` → `/referral`; closing/футер — Telegram.  
Viewport &lt; 768px → оверлей `desktop-only-screen` ([`mobile.md`](mobile.md)).

Клиентский кэш ленты: `sessionStorage` ключ `obratka.homeLists.<userId>`; seen готовых отчётов: `localStorage` `obratka.mineReadySeen.<userId>`; seen кейсов ленты: `localStorage` `obratka.feedSeen.<userId>` (все сбрасываются на logout).  
`localStorage`-сессия — UX-кэш: boot проверяет cached `userId` через Supabase Auth; auth-gated deep links без user не открываются.
Таймер просмотра: `REVIEW_SESSION_SECONDS` в `src/config/review.js` (не путать с claim TTL 20 min).  
Диктовка: [`src/lib/dictation/README.md`](src/lib/dictation/README.md).  
Polish: [`supabase/functions/polish-dictation/README.md`](supabase/functions/polish-dictation/README.md) (§ «Статус»: клиентский kill-switch).
## Auth (кратко)

| Провайдер | Модуль |
|-----------|--------|
| Telegram | `auth.js` + `telegramWidget.js` + `supabase/functions/telegram-auth/` |
| Google | `signInWithGoogle` / `completeOAuthFromUrl` |
| Email OTP | UI off (`EMAIL_AUTH_ENABLED`). API `requestEmailOtp` / `verifyEmailOtp` + `auth-code-screen` |
| Ошибки Auth | `mapSupabaseAuthErrorCode` → UI (`authIdentityConflict`, rate-limit, …) |

**Защита:** Automatic linking Email↔Google (Dashboard/GoTrue); cooldown resend OTP (`--auth-code-resend-cooldown`); Telegram изолирован.  
Подробно: [`auth-screen/README.md`](src/components/auth-screen/README.md), [`PROJECT.md`](PROJECT.md) § Auth.

## Комментарии в JSON

Пояснения к `content/*.json` — соседние `*.md` и [`content/README.md`](content/README.md).
