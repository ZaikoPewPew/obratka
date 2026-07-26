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
| `src/` | Код: `main.js`, `app/`, `components/`, `utils/`, `api/`, `config/` ([README](src/config/README.md): review session + contacts), `lib/` ([README](src/lib/README.md): supabase + **dictation**), `assets/` |
| `styles/` | Токены + UI. Entry: tokens/base/entrance/app-modal/iframe-shell/home/legendary-online-panel/contact-fab/tabs-panel/account-menu/settings/success/ban/report |
| `content/` | `locales.json`, onboarding, embed-hosts, founder-avatars |
| `public/` | Статика по URL (favicon и т.п.) |
| `supabase/` | SQL (`profiles`, `legendary_presence`, `rating_leaderboard`, `wallet`, `portfolios`, `portfolio_submit`, `review_claims`, `review_complaints`, `referrals`, …) + Edge `telegram-auth`; доступы и адвайзоры — `SECURITY.md` |
| `.cursor/` | Правила агента (`rules/*.mdc`) и карта (`.cursor/README.md`) |

### Brand UI (кратко)

| Модуль | Документ |
|--------|----------|
| Правый visual | [`src/components/brand-screen-visual/README.md`](src/components/brand-screen-visual/README.md) |
| Split-каркас | [`src/components/brand-screen-shell/README.md`](src/components/brand-screen-shell/README.md) |
| App modal | [`src/components/app-modal/README.md`](src/components/app-modal/README.md) |
| Tabs panel | [`src/components/tabs-panel/README.md`](src/components/tabs-panel/README.md) |
| Ошибки полей | [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) |
| Марки / morph | [`src/assets/README.md`](src/assets/README.md) |

## Экраны и URL (кратко)

Полная таблица — [`SCREENS.md`](SCREENS.md) и [`src/app/README.md`](src/app/README.md).

```text
/referral → /registration → /onboarding → /home
  → pick → intro → claim → /review → /quiz → /quiz/done
  → mine → gate → /report | /portfolio → /done | /banned
```

`/referral` — invite-only gate (`validate_referral`); после входа у юзера свой код (лимит 2), шаринг с home.  
`/home` — feed/mine/rating; активный вид хранится в query через `homeRoute`; feed/mine/rating используют SWR-кэш (`homeListCache`); рейтинг — топ-50 (`listRatingTop`); aside «Легенды онлайн»; FAB «быстрая связь» (`contact-fab`). Intro до claim; отправленный отчёт → disabled-карточка; mine report gate; фильтр Активные/Завершенные (`tabs-panel`); free-slot «Мои на ревью» до `MAX_MINE_PENDING` (=1); точка на «На ревью» (`feedSeen`); точка на «Мои» и «Завершенные» (`mineReadySeen`); tabbar-dock (glass tabs + «Закинуть своё») с контрастом над превью.
`/portfolio` — подача URL; чип «На главную» (скрыт на done); done на том же экране.  
`/review` = просмотр портфолио + таймер **45 s** (`REVIEW_SESSION_SECONDS` в `src/config/review.js`) + опциональная надиктовка (чип rec → `answers.dictation`).  
`/quiz` = опрос; в поле «Главный совет» — микрофон (тот же `DictationEngine` → текст в `advice`). Не путать с login-`session.js` (`obratka.session`).  
`/report` = листы ревью автора (+ секция надиктовки) + жалоба → `reputation` (вход только когда собраны все ревью).  
`/banned` = бан (в т.ч. автобан по репутации).

Клиентский кэш ленты: `sessionStorage` ключ `obratka.homeLists.<userId>`; seen готовых отчётов: `localStorage` `obratka.mineReadySeen.<userId>`; seen кейсов ленты: `localStorage` `obratka.feedSeen.<userId>` (все сбрасываются на logout).  
`localStorage`-сессия — UX-кэш: boot проверяет cached `userId` через Supabase Auth; auth-gated deep links без user не открываются.
Таймер просмотра: `REVIEW_SESSION_SECONDS` в `src/config/review.js` (не путать с claim TTL 20 min).  
Диктовка: [`src/lib/dictation/README.md`](src/lib/dictation/README.md).
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
