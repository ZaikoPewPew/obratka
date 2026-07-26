# Обратка — продукт и архитектура

Взаимное ревью портфолио: пользователь регистрируется, проходит онбординг, смотрит чужие работы (таймер + опциональная надиктовка + квиз) и/или подаёт свой URL в общую очередь.

**Стек:** Vite + vanilla JS, Supabase Auth / Postgres / Edge Function, i18n из `content/locales.json`, дизайн-токены в `styles/tokens.css`.

Карта экранов: [`SCREENS.md`](SCREENS.md). Структура папок: [`STRUCTURE.md`](STRUCTURE.md).

## Состояние (кратко)

| Область | Статус |
|---------|--------|
| Path-роутинг + entry по сессии | wired |
| Auth: Email OTP, Telegram, Google | wired → `auth.users` + `profiles` |
| Онбординг → `profiles` | wired |
| Home: лента/мои/рейтинг, URL-query, баланс, репутация, account-menu | wired (рейтинг — placeholder) |
| Home: SWR-кэш вкладок + silent slot patch | wired (`homeListCache.js`) |
| Home tabbar dock: glass + «Закинуть своё» справа | wired (`tabbar-dock`, `--on-dark`) |
| Review claim / heartbeat / release | wired (награда только после submit) |
| Review iframe + таймер 45 s + **надиктовка** (rec на `/review` + микрофон в поле совета) + квиз | wired |
| Подача URL + back-chip + done на url-screen | wired |
| Report: листы (+ `dictation`) + жалоба + PDF | wired |
| Referrals validate/redeem / share | wired (1 код / 2 слота, seed `YTHWKPDWAK`, без наград) |
| App modal (shared overlays) | wired |
| Settings `/settings` | UI-заглушка |
| Legacy waitlist UI | **удалён** (спека в `mobile.md` § Архив) |

### Home — что нового в UX

- **SWR ленты:** `feed` / `mine` в memory + `sessionStorage` (`obratka.homeLists.<userId>`); open / смена таба / F5 без skeleton при hit; тихий `refresh`; logout → `clearHomeListCache`.
- **Silent refresh:** при тех же id карточек — патч только reviewer-слотов (без thum.io); новые id — rebuild + reveal только для них.
- **Порядок feed:** `sortFeedForSlotClosure` — open slot → ближе к 3/3 → FIFO; `reviewedByMe` / full вниз (не newest-first). См. home-screen README.
- **Отправленный отчёт:** `reviewedByMe` появляется только после INSERT в `reviews`; карточка disabled с оверлеем «Отчёт отправлен», без intro/notice и повторного claim.
- **Intro до claim:** клик по чужой карточке → `createAppModal` `homeReviewIntro*` (шаг 1 с `{seconds}` = `REVIEW_SESSION_SECONDS`) → CTA «Проревьюить» → claim → `/review`. «Не сейчас» / закрытие — без claim.
- **Mine report gate:** `reviewsCount < targetReviews` → `homeMineNotReady*`; иначе `/report`. Own-карточки всегда `cursor: pointer` (не `not-allowed`).
- **Фильтр «Мои»:** сегмент Активные / Завершенные (`tabs-panel`); завершённые = 3/3 (`reviewsCount >= targetReviews`).
- **Вкладка «Рейтинг»:** третий tab `rating`; пока локализованный placeholder без API, skeleton и list-кэша.
- **Deep links home:** `/home`, `?tab=mine`, `?tab=mine&filter=completed`, `?tab=rating`; query канонизирует `homeRoute.js`, Back/Forward переключает вид без remount.
- **Таймер:** `src/config/review.js` → `REVIEW_SESSION_SECONDS = 45` (review shell + intro copy).
- **Tabbar dock:** glass-таббар + кнопка «Закинуть своё» справа (56×56, Google blue, gap 8px); hide при скролле уезжает весь док. Светлый трек — gray-900 20% + blur 20; тёмный превью → `--on-dark` — white 20%.
- **Чипы шапки:** репутация → баланс → аватар. Submit и уведомления из topbar убраны.
- **Точка на «Мои посты»:** красная 6px в углу вкладки при **непросмотренном** готовом отчёте (3/3); визит «Мои» гасит (`mineReadySeen`), новый готовый id снова зажигает.
- Подробно: [`home-screen/README.md`](src/components/home-screen/README.md).

## Продуктовый флоу

```text
/referral → /registration → /onboarding → /home
                              ├─ pick → intro-модалка → /review → /quiz → /quiz/done
                              ├─ mine → /report (все ревью собраны) / модалка «ещё собирается»
                              └─ submit → /portfolio → done (URL sync /done)
```

Корень `/` → `resolveEntryScreen(getSession())` в `src/app/flow.js`. Auth-gated deep links без живой сессии идут в referral/auth; пользователь без завершённого онбординга — в `/onboarding`. На boot cached `userId` проверяется через Supabase Auth, stale UX-кэш очищается с сохранением referral-кода.
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

**Вне скоупа (roadmap #2):** Manual `linkIdentity` UI, UNIQUE `profiles.email`, склейка Telegram↔email.

Документация: [`auth-screen/README.md`](src/components/auth-screen/README.md), [`auth-code-screen/README.md`](src/components/auth-code-screen/README.md), [`src/api/README.md`](src/api/README.md).

## Рефералы (invite-only)

Без наград: код → вход → свой код → поделиться.

| Что | Детали |
|-----|--------|
| Gate | `/referral` → RPC `validate_referral` (anon) до auth |
| Redeem | после логина `redeem_referral` (один раз на аккаунт) |
| Код юзера | `profiles.referral_code`, max **2** активации |
| Seed | `YTHWKPDWAK` в `referral_seed_codes` (холодный старт) |
| Шаринг | home → аватар → account-menu → «Пригласить» (`homeInvite*`) |
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
Доступы к RPC, адвайзоры, отложенное до Pro: [`supabase/SECURITY.md`](supabase/SECURITY.md).

## Лиги ревью

Тихий матчинг по `profiles.grade` (UI «лиг» нет). Клиент-зеркало: [`src/api/leagues.js`](src/api/leagues.js). Правило: `.cursor/rules/leagues.mdc`.

| Портфолио | Ревьюеры |
|-----------|----------|
| Junior | Junior, Middle |
| Middle | Middle, Senior+ |
| Senior+ | Senior+ |

Senior → Junior нельзя. Grade обязателен в онбординге. Claims / INSERT тоже проверяют лигу.

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

**Вне v1:** `misleading`, очередь модерации, троттлинг жалобщиков, публичный рейтинг репутации, влияние на лиги.

## Слои UI

| Слой | Где |
|------|-----|
| Brand split (referral / auth / auth-code / onboarding / url) | `.url-screen*` + [`brand-screen-visual`](src/components/brand-screen-visual/README.md); цель — `brand-screen-shell`; на `/portfolio` — back-chip top-left |
| Field errors | [`FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) — текст + обводка; visual `invalid` |
| App modal | [`app-modal`](src/components/app-modal/README.md) — общий диалог (слот контента + primary/secondary); Figma Modal |
| Home | `home-screen` + `account-menu` + `tabs-panel`; feed/mine/rating; URL-query; лента SWR; Активные/Завершенные; tabbar-dock (tabs + submit + точка 3/3) / `--on-dark` |
| Review | `index.html` `.iframe-shell` + таймер + чип **rec** (заметки → `answers.dictation`) в `main.js` |
| Quiz | `review-screen` + `review-panel` (микрофон в поле «Главный совет» → `advice`) |
| Success | `success-screen` (`/done`) |
| Ban | `ban-screen` — статичный красный mesh + `banBrandMarkSvg` |
| Report | `report-screen` — листы (+ надиктовка) + жалоба + PDF |
| Settings | `settings-screen` (`/settings`, заглушка) |

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

## Entrypoint

**Подключено** (`index.html` + `main.js`):

- CSS: `tokens`, `base`, `entrance`, `app-modal`, `iframe-shell`, `success-screen`, `home-screen`, `tabs-panel`, `account-menu`, `settings-screen`, `ban-screen`, `report-screen`
- Экраны: referral, auth, auth-code, onboarding, home, settings, url, review-shell (+ rec), quiz, success, report, ban
- Shared UI: `brand-screen-visual`, `brand-screen-shell`, `app-modal`, `account-menu`, `tabs-panel`
- Home state: `src/utils/homeRoute.js` (query) + `homeListCache.js` + `mineReadySeen.js` (кэши сбрасываются в `exitAuthenticatedSession`)
- Review timer: `src/config/review.js` (`REVIEW_SESSION_SECONDS`)
- Dictation: `src/lib/dictation/` (Web Speech MVP)
- Url-screen: чип «На главную» (`.url-screen__back`, скрыт на done) → `onExit` → home

Waitlist dual-layout удалён; историческая спека — [`mobile.md`](mobile.md) § Архив.

## Env (кратко)

| Где | Что |
|-----|-----|
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TELEGRAM_BOT_ID` (+ optional username), `VITE_BASE_PATH` |
| Dashboard Auth | Email OTP, Google OAuth, Redirect URLs |
| Edge secrets | `TELEGRAM_BOT_TOKEN` |

## Roadmap (код)

1. Вынести общие split-стили в `brand-screen.css` (классы пока `.url-screen*`).
2. Manual identity linking UI (`linkIdentity`) + UNIQUE `profiles.email` + склейка Telegram↔email — вне текущего скоупа.  
   Email↔Google закрывается **Automatic linking** в Supabase Auth (verified email = один user); см. [`auth-screen/README.md`](src/components/auth-screen/README.md).
3. Троттлинг злоупотреблений жалобой / тег `misleading` / очередь модерации.
4. Редизайн жалоб / списка листов на `report-screen` (PDF-сводка уже есть).
5. Диктовка план B: Whisper через Edge (контракт `DictationEngine` уже есть; MVP = Web Speech) — [`src/lib/dictation/README.md`](src/lib/dictation/README.md).

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
