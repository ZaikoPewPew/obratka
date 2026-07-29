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
| Home: лента/мои/рейтинг, URL-query, баланс, репутация, account-menu | wired (рейтинг — `listRatingTop` / топ-50) |
| Home: SWR-кэш вкладок + silent slot patch | wired (`homeListCache.js`: feed/mine/rating) |
| Home: точка «новый кейс» на «На ревью» | wired (`feedSeen.js` + `listFeedPortfolioIds`) |
| Home: «Топы в сети» (fixed-чип) | wired (`legendary-online-panel` + `legendary_presence`) |
| Home: free-slot «Мои» + max 1 pending | wired (`MAX_MINE_PENDING`, `submit_portfolio`) |
| Home tabbar dock: glass + «Закинуть своё» справа | wired (`tabbar-dock`, `--on-dark`, entrance `motion-reveal-dock`) |
| Review claim / heartbeat / release | wired (награда только после submit; unload = keepalive + `sessionStorage` reconcile; **overshoot** — см. § Claims) |
| Review iframe + таймер 45 s + **надиктовка** (rec на `/review` + микрофон в поле совета) + квиз | wired |
| Подача URL + back-chip + done на url-screen | wired |
| Report: листы (+ `dictation`) + жалоба + PDF | wired |
| Referrals validate/redeem / share | wired (1 код / 2 слота, seed `YTHWKPDWAK`, без наград) |
| App modal (shared overlays) | wired |
| Settings `/settings` | UI-заглушка |
| Legacy waitlist UI | **удалён** (спека в `mobile.md` § Архив) |

### Home — что нового в UX

- **SWR ленты:** `feed` / `mine` / `rating` в memory + `sessionStorage` (`obratka.homeLists.<userId>`); open / смена таба / F5 без skeleton при hit; тихий `refresh`; logout → `clearHomeListCache`.
- **Silent refresh:** при тех же id карточек — патч только reviewer-слотов (без thum.io); новые id — rebuild + reveal только для них.
- **Порядок feed:** `sortFeedForSlotClosure` — ближе к 3/3 → FIFO; `reviewedByMe` вниз (не newest-first). Дверь claim = `reviews_count < target` (live не лимит; late overshoot ок). См. home-screen README.
- **Отправленный отчёт:** `reviewedByMe` появляется только после INSERT в `reviews`; карточка disabled с оверлеем «Отчёт отправлен», без intro/notice и повторного claim.
- **Intro до claim:** клик по чужой карточке → если уже набрали target (`isPortfolioOpenForReview`) → `homeNoSlots*`; иначе `createAppModal` `homeReviewIntro*` (тайтл + описание + видео-пример, CTA «Сюдаа его!») → claim → `/review`. «Не сейчас» / закрытие — без claim.
- **Abort / hard nav:** SPA `releaseHeldClaim`; `pagehide` → `releasePortfolioClaimKeepalive`; per-tab `obratka.reviewClaim` + boot reconcile — active «Аноним» не залипает после ухода (см. `review-claims.mdc`). SQL: `portfolio_reviewer_slots` чистит expired перед list.
- **Mine report gate:** `reviewsCount < targetReviews` → `homeMineNotReady*`; иначе `/report`. Own-карточки всегда `cursor: pointer` (не `not-allowed`).
- **Фильтр «Мои»:** сегмент Активные / Завершенные (`tabs-panel`); завершённые = 3/3 (`reviewsCount >= targetReviews`).
- **Free-slot «Мои на ревью»:** до `MAX_MINE_PENDING` (=1) — реальная карточка или dashed «Свободный слот» (`homeMineSlotFree*`). CTA «Закинуть»: сначала занятый слот → `homePendingLimit*`, потом нет монет → buzz на submit + чипе баланса. Подача — RPC `submit_portfolio` (atomic spend+insert).
- **Экономика:** `REVIEW_REWARD = 10`, `SUBMIT_COST = 30` (старт `balance = 0` → 3 чужих ревью до своей подачи). Награда только после submit отчёта; abort/release claim — без монет. Свободный слот + нет монет на «Закинуть своё» → error-buzz на submit + чипе баланса (без модалки). Правило: `.cursor/rules/wallet.mdc`.
- **Вкладка «Рейтинг»:** третий tab `rating`; топ-50 по `balance` (`listRatingTop` / `rating_leaderboard.sql`, снапшот раз в сутки); карточки в `.home-screen__rating-list` (aside `rating/` **не** монтируется); плашка баланса `min-width`/`height` 52px, padding-x 16px.
- **«Топы в сети»:** fixed-чип слева снизу (`legendary-online-panel` + heartbeat/list RPC); скрыт, если никого нет.
- **Deep links home:** `/home`, `?tab=mine`, `?tab=mine&filter=completed`, `?tab=rating`; query канонизирует `homeRoute.js`, Back/Forward переключает вид без remount.
- **Таймер:** `src/config/review.js` → `REVIEW_SESSION_SECONDS = 45` (review shell + intro copy). iframe — пауза при скрытой вкладке; external — wall-clock без паузы; конец → `src/assets/audio/Timer-end.wav` + стоп надиктовки → quiz.
- **Tabbar dock:** glass-таббар + кнопка «Закинуть своё» справа (56×56, Google blue, gap 8px); hide при скролле уезжает весь док. Светлый трек — gray-900 10% + blur 20; тёмный превью → `--on-dark` — white 20%.
- **Чипы шапки:** репутация → баланс → аватар. Submit и уведомления из topbar убраны.
- **Точка на «На ревью»:** красная 6px в углу вкладки при **новом** кейсе в ленте; открытие «На ревью» гасит (`feedSeen`), новый id снова зажигает.
- **Точка на «Мои посты»:** красная 6px в углу вкладки при **непросмотренном** готовом отчёте (3/3); открытие «Завершенные» гасит (`mineReadySeen`), новый готовый id снова зажигает.
- Подробно: [`home-screen/README.md`](src/components/home-screen/README.md).

## Продуктовый флоу

```text
/referral → /registration → /onboarding → /home
                              ├─ pick → intro-модалка → /review → /quiz → /quiz/done
                              ├─ mine → /report (все ревью собраны) / модалка «ещё не готов»
                              └─ submit → /portfolio → done (URL sync /done)
```

Корень `/` → `resolveEntryScreen(getSession())` в `src/app/flow.js`. Auth-gated deep links без живой сессии идут в referral/auth; пользователь без завершённого онбординга — в `/onboarding`. На boot cached `userId` проверяется через Supabase Auth; stale UX-кэш чистится (`clearSession`), device invite gate (`obratka.inviteGatePassed`) переживает logout.
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
| Gate | `/referral` → RPC `validate_referral` (anon) до auth; после успеха — `obratka.inviteGatePassed` (раз на устройство) |
| Redeem | после логина `redeem_referral` (один раз на аккаунт) |
| Код юзера | `profiles.referral_code`, max **2** активации |
| Seed | `YTHWKPDWAK` в `referral_seed_codes` (холодный старт) |
| Logout | при gate → `/registration`; иначе → `/referral`. Deep link `/referral` / `?ref=` не ломаем |
| Шаринг | home → аватар → account-menu → «Пригласить» (`homeInvite*`); copy/share = полный `homeInviteMessage` (`{url}`, `{code}`) |
| SQL / API | [`supabase/sql/referrals.sql`](supabase/sql/referrals.sql), [`src/api/referrals.js`](src/api/referrals.js), [`src/utils/inviteGate.js`](src/utils/inviteGate.js) |

## Данные (Supabase)

| Сущность | Файл / роль |
|----------|-------------|
| `auth.users` | Supabase Auth |
| `public.profiles` | 1:1 с user; онбординг, баланс, `reputation`, tier, ban, `referral_code` (лимит 2); триггер `handle_new_user` |
| `public.referral_seed_codes` | bootstrap-коды (seed `YTHWKPDWAK`); только через RPC |
| `public.portfolios` / `reviews` | очередь ревью с матчингом по лиге грейда |
| `public.review_complaints` | жалобы автора (1 тег, окно 6ч) → −20 / +10 settle → автобан при `reputation <= -100` |
| `public.subscribers` | legacy waitlist API (`subscribers.js`), не entry UX |
| Edge `telegram-auth` | проверка Telegram hash → сессия |

SQL: [`supabase/sql/`](supabase/sql/), обзор [`supabase/README.md`](supabase/README.md).
Бан / автобан по репутации: [`supabase/BAN.md`](supabase/BAN.md).
Доступы к RPC, адвайзоры, отложенное до Pro: [`supabase/SECURITY.md`](supabase/SECURITY.md).

## Лиги ревью

Тихий матчинг по `profiles.grade` (UI «лиг» нет). Клиент-зеркало: [`src/api/leagues.js`](src/api/leagues.js). Правило: `.cursor/rules/leagues.mdc`.

| Лига | `profiles.grade` |
|------|------------------|
| 1 | `junior`, **null / unknown** |
| 2 | `middle` |
| 3 | `senior`, `lead`, `head` |

Null/unknown **не** пишем в `junior` в БД: матчинг = лига 1; UI = `gradeUndefined` («Грейд не определён»). Оператор может поправить grade руками.

| Портфолио | Ревьюеры |
|-----------|----------|
| Junior (и null) | Junior (и null), Middle |
| Middle | Middle, Senior+ |
| Senior+ | Senior+ |

Senior → Junior нельзя. Grade обязателен в онбординге UI; серверный fallback лиги 1 — safety net. Claims / INSERT тоже проверяют лигу.

## Claims, слоты и overshoot

Цель: автору **достаточно** `target_reviews` (default **3**) completed-отчётов — карточка уходит из ленты в «Завершенные». Не ловим realtime «ровно трое в комнате» и **не кикаем** тех, кто уже внутри, если листов стало больше трёх.

Правило агента: [`.cursor/rules/review-claims.mdc`](.cursor/rules/review-claims.mdc). SQL: [`review_claims.sql`](supabase/sql/review_claims.sql) (+ RLS insert в [`portfolios.sql`](supabase/sql/portfolios.sql)).

### Дверь

| Событие | Правило |
|---------|---------|
| Карточка в ленте | `status = pending` и `reviews_count < target` |
| Новый claim | пока `reviews_count < target` (и лига / не своё / не `already_reviewed`). **Live claims не лимит** |
| `no_slots` / `homeNoSlots*` | уже набрали target completed (не «трое сидят внутри») |
| UI слотов на карточке | первые **target** лиц (completed + active «Аноним»); лишние в кружках не рисуем |
| `/report` + PDF + жалобы | **все** листы по portfolio, без cap на 3 |

### In-flight (4-й / N-й ревьюер)

Пока карточка ещё pending, несколько человек могут взять claim. Когда третьи сдают отчёт → `status = done`, лента закрыта. Остальные с **живым claim**:

1. **Сессию не рвём** — клиент не смотрит `status`/`reviews_count` mid-review/quiz и не делает `go("home")` из‑за закрытия карточки. Heartbeat при ошибке только логирует (DEV), не abort.
2. **Heartbeat / release** — security definer RPC, не зависят от SELECT портфолио (после `done` чужой SELECT по RLS ленты уже закрыт — это ок).
3. **Submit** — INSERT с валидным claim принимается при `status in ('pending','done')`; `reviews_count` растёт сверх target; **та же +10**; claim снимается. RLS `reviews_insert_own` и триггер `handle_review_inserted` оба допускают `done`.
4. Без claim / после abort — как раньше, без монет.

```text
A,B,C,D взяли claim (карточка ещё < 3 completed)
A,B,C сдали → done, лента закрыта, автору «Завершенные»
D спокойно дописывает квиз → INSERT +10 → 4-й лист в report/PDF
```

Не путать с abort: уход с `/review` / pagehide без submit → `release` → слот «Аноним» исчезает, награды нет.

### Клиентское зеркало

- `isPortfolioOpenForReview` — `reviewsCount < target` (без вычета live).
- `sortFeedForSlotClosure` — remaining до target → FIFO; live не двигает карточку вниз.
- Оркестрация claim: `main.js` (`claimHeld`, heartbeat, `releaseHeldClaim`, keepalive).

## Репутация и жалобы на листы

Цель: ловить халяву / спам / травлю / нецелевое, не превращая обиду на жёсткую критику в бан.

| Что | Детали |
|-----|--------|
| Где UI | `/report` — список листов; «Пожаловаться» → модалка (1 тег). Без жалобы = ок; окно 6ч |
| Теги v1 | `low_effort`, `spam`, `harassment`, `offensive`, `ai_slop` (веса только в SQL) |
| Штраф / плюс | жалоба = −20 (1 тег); старт `20`; бан при `<= -100`; +10 после окна без жалобы |
| Ревьюер | чип = абсолют со знаком + explainer **без** таблицы весов |
| Апелляция | вручную («Связаться» на `/banned`) |
| SQL / API | [`review_complaints.sql`](supabase/sql/review_complaints.sql), [`reviewComplaints.js`](src/api/reviewComplaints.js) |

**Вне v1:** `misleading`, очередь модерации, троттлинг жалобщиков, публичный рейтинг репутации, влияние на лиги.

## Слои UI

| Слой | Где |
|------|-----|
| Brand split (referral / auth / auth-code / onboarding / url) | `.url-screen*` + [`brand-screen-visual`](src/components/brand-screen-visual/README.md) + [`brand-screen-shell`](src/components/brand-screen-shell/README.md); на `/portfolio` — back-chip top-left |
| Field errors | [`FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) — текст + обводка; visual `invalid` |
| App modal | [`app-modal`](src/components/app-modal/README.md) — общий диалог (слот контента + primary/secondary); Figma Modal |
| Side panel | [`side-panel`](src/components/side-panel/README.md) — панель справа (слот); home → «Правила» |
| Home | `home-screen` + `account-menu` + `tabs-panel` + `legendary-online-panel` + `contact-fab`; feed/mine/rating (`listRatingTop`); URL-query; лента SWR; Активные/Завершенные; tabbar-dock (tabs + submit + точки feedSeen / 3/3) / `--on-dark` / entrance cascade |
| Review | `index.html` `.iframe-shell` + таймер + чип **rec** (заметки → `answers.dictation`) в `main.js` |
| Quiz | `review-screen` + `review-panel` + [`scale-slider`](src/components/scale-slider/README.md) (context/visual **1–5**; условный `pain`; рыночный `tier`) + mic → `advice`. SoT: [`QUIZ.md`](QUIZ.md) |
| Success | `success-screen` (`/done`) |
| Ban | `ban-screen` — статичный красный mesh + `banBrandMarkSvg` |
| Report | `report-screen` — листы (+ надиктовка) + жалоба + PDF |
| Settings | `settings-screen` (`/settings`, заглушка) |

Handoff соседних brand-экранов: `go(id, { handoff: true })` — правый visual без повторной анимации.

Visual variants: `default` / `invalid` (рожки без resize) / `done` (logo-done). Подробно — README `brand-screen-visual`.

## Квиз и отчёт

Пул вопросов после `/review` → `/quiz`, схема `reviews.answers`, зоны шкал, L1/L2/L3 PDF и условный `pain` — **[`QUIZ.md`](QUIZ.md)**.

Кратко:

- Шкалы **context** и **visual** обе **1–5** ([`scale-slider`](src/components/scale-slider/README.md)).
- `pain[]` показывается только при `visual ≤ 2` (composition / contrast / components / overloaded).
- Вердикт рынка — поле **`tier`** (`early` · `mid` · `strong` · `top`), не `hire`.
- Отчёт: `buildReportSections` в [`reviewReport.js`](src/utils/reviewReport.js); preview без кросс-сигналов; full — L2 + матрица `tier × gradeZone` + `reportSummaryLead`.
- Старые answers с `hire` / visual 1–10 не парсятся.

## Дизайн и i18n

- Токены: `styles/tokens.css` (правило `.cursor/rules/design-tokens.mdc`).  
  В компонентах только `var(--…)`, шрифт Montserrat.
- Motion: `--motion-*` (в т.ч. `--motion-field-error-*`, `--app-modal-*`), `entrance.css` (`motion-reveal` / `-scale` / `-topbar` / `-dock`), `src/utils/motionTokens.js`. Home: `--home-screen-reveal-delay-*` (cascade на `--open`; dock без opacity ради glass blur).
- Field errors: [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md).
- Brand visual: [`brand-screen-visual`](src/components/brand-screen-visual/README.md).
- App modal: [`app-modal`](src/components/app-modal/README.md).
- Side panel: [`side-panel`](src/components/side-panel/README.md).
- Строки: `content/locales.json` + `src/i18n.js` (правило `.cursor/rules/i18n.mdc`); close aria модалки — `modalCloseAria`.
- Тема: `<html data-theme="dark">` (семантика в токенах).

## Entrypoint

**Подключено** (`index.html` + `main.js`):

- CSS: `tokens`, `base`, `entrance`, `app-modal`, `side-panel`, `iframe-shell`, `success-screen`, `home-screen`, `legendary-online-panel`, `contact-fab`, `tabs-panel`, `account-menu`, `settings-screen`, `ban-screen`, `report-screen`
- Экраны: referral, auth, auth-code, onboarding, home, settings, url, review-shell (+ rec), quiz, success, report, ban
- Shared UI: `brand-screen-visual`, `brand-screen-shell`, `app-modal`, `side-panel`, `account-menu`, `tabs-panel`, `legendary-online-panel`, `contact-fab`, `scale-slider`
- Home state: `src/utils/homeRoute.js` (query) + `homeListCache.js` + `feedSeen.js` + `mineReadySeen.js` (кэши сбрасываются в `exitAuthenticatedSession`)
- Review timer: `src/config/review.js` (`REVIEW_SESSION_SECONDS`); iframe pause / external wall-clock; end sound `src/assets/audio/Timer-end.wav`
- Dictation: `src/lib/dictation/` (Web Speech MVP; external `setKeepAliveInBackground`)
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
