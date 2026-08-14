# Обратка — продукт и архитектура

Взаимное ревью портфолио: пользователь регистрируется, проходит онбординг, смотрит чужие работы (таймер + опциональная надиктовка + квиз) и/или подаёт свой URL в общую очередь.

**Стек:** Vite + vanilla JS, Supabase Auth / Postgres / Edge Function, i18n из `content/locales.json`, дизайн-токены в `styles/tokens.css`.

Карта экранов: [`SCREENS.md`](SCREENS.md). Структура папок: [`STRUCTURE.md`](STRUCTURE.md).

## Состояние (кратко)

| Область | Статус |
|---------|--------|
| Path-роутинг + entry по сессии | wired |
| Auth: Telegram, Google | wired → `auth.users` + `profiles`. Email OTP — UI off (`EMAIL_AUTH_ENABLED = false`); код/экран `/registration/code` остаются |
| Онбординг → `profiles` | wired |
| Home: лента/мои, URL-query, баланс, репутация, account-menu | wired. Вкладка «Рейтинг» (топ-50 / `listRatingTop`) — **UI off** (`RATING_TAB_ENABLED = false`); `?tab=rating` → feed; чип репутации живой |
| Home: SWR-кэш вкладок + silent slot patch | wired (`homeListCache.js`: feed/feedReviewed/mine/rating) |
| Home: точка «новый кейс» на «Чужие посты» | wired (`feedSeen.js` + `listFeedPortfolioIds`) |
| Home: сегмент «Ждёт / Уже отревьюено» | wired (`listReviewedPortfolios` + `tabs-panel` на feed; RLS exists review) |
| Home: «Топы в сети» (fixed-чип) | wired (`legendary-online-panel` + `legendary_presence`) |
| Home: free-slot «Мои» + max 1 pending | wired (`MAX_MINE_PENDING`, `submit_portfolio`) |
| Home tabbar dock: glass + «Закинуть своё» справа | wired (`tabbar-dock`, `--on-dark`, entrance `motion-reveal-dock`) |
| Review claim / heartbeat / release | wired (награда только после submit; unload = keepalive + `sessionStorage` reconcile; **overshoot** — см. § Claims) |
| Review: iframe/external + таймер 60 s + **надиктовка** | wired (embed-hosts + probe/fallback; rec + mic в совете; post-edit `polish-dictation` **клиент off** — `POLISH_ENABLED = false`; SoT [`embed-hosts.md`](content/embed-hosts.md), [`polish-dictation/README`](supabase/functions/polish-dictation/README.md)) |
| Подача URL + back-chip + done на url-screen | wired |
| Report: листы (+ `dictation`) + жалоба + PDF | wired (сводный PDF + action cards — [`ACTION_CARDS.md`](ACTION_CARDS.md)) |
| Referrals validate/redeem / share | wired (1 код / 2 слота, seed `YTHWKPDWAK`, без наград) |
| Analytics (PostHog) | wired — pageviews + core funnel; SoT [`ANALYTICS.md`](ANALYTICS.md) |
| App modal (shared overlays) | wired |
| Settings `/settings` | wired (view-only side-panel, без Save) |
| SPA not-found `/404` | wired (`not-found-screen`; мусорный path → `/404`) |
| Landing `/landing/` | wired (MPA entry, без session; CTA Telegram-first; [`landing/README.md`](landing/README.md)) |
| Legacy waitlist UI | **удалён** (спека в `mobile.md` § Архив) |
| Mobile | **desktop-only** (&lt;768px → `desktop-only-screen`; см. `mobile.md`) |

### Home — что нового в UX

- **SWR ленты:** `feed` / `feedReviewed` / `mine` / `rating` в memory + `sessionStorage` (`obratka.homeLists.<userId>`); open / смена таба / F5 без skeleton при **непустом** hit; кэш `[]` → skeleton до confirm refresh; тихий `refresh`; logout → `clearHomeListCache`.
- **Silent refresh:** при тех же id карточек — патч только reviewer-слотов (без thum.io); новые id — rebuild + reveal только для них.
- **Порядок feed:** `sortFeedForSlotClosure` — ближе к 3/3 → FIFO (не newest-first). Уже отревьюенные (`reviewedByMe`) **фильтруются** из open-ленты («Ждёт ревью») до сорта; видны в сегменте «Уже отревьюено» (`listReviewedPortfolios`). Дверь claim = `reviews_count < target` (live не лимит; late overshoot ок). См. home-screen README.
- **Отправленный отчёт:** `reviewedByMe` только после INSERT в `reviews`; карточка уходит из «Ждёт ревью» (и из `listFeedPortfolioIds` для точки «новый кейс») в «Уже отревьюено», без intro/notice и повторного claim. В сегменте вместо скриншота — серое превью с галочкой + `homeCardReviewedLabel` (hover/press на заливке превью); слоты ревьюеров и зона автора обычные; клик → URL портфолио в новой вкладке.
- **Intro до claim:** клик по чужой карточке → если уже набрали target (`isPortfolioOpenForReview`) → `homeNoSlots*`; иначе `createAppModal` `homeReviewIntro*` (тайтл + описание + видео-пример, CTA «Сюдаа его!») → claim → `/review`. «Не сейчас» / закрытие — без claim.
- **Abort / hard nav:** SPA `releaseHeldClaim`; `pagehide` → `releasePortfolioClaimKeepalive`; per-tab `obratka.reviewClaim` + boot reconcile — active «Аноним» не залипает после ухода (см. `review-claims.mdc`). SQL: `portfolio_reviewer_slots` чистит expired перед list.
- **Mine report gate:** `reviewsCount < targetReviews` → `homeMineNotReady*`; иначе `/report`. Own-карточки всегда `cursor: pointer` (не `not-allowed`).
- **Сегменты tabs-panel:** на «Чужие посты» — Ждёт ревью / Уже отревьюено; на «Мои» — Ещё на ревью / Завершенные (`reviewsCount >= targetReviews`).
- **Free-slot «Ещё на ревью»:** до `MAX_MINE_PENDING` (=1) — реальная карточка или dashed «Свободный слот» (`homeMineSlotFree*`). CTA «Закинуть»: сначала занятый слот → toast `homeNotifySlotTaken`, потом нет монет → toast `homeNotifyNoDucks` + buzz на submit + чипе баланса. Подача — RPC `submit_portfolio` (atomic spend+insert).
- **Экономика:** `REVIEW_REWARD = 10`, `SUBMIT_COST = 30` (старт `balance = 0` → 3 чужих ревью до своей подачи). Награда только после submit отчёта; abort/release claim — без монет. Свободный слот + нет монет на «Закинуть своё» → error-buzz на submit + чипе баланса (без модалки). Правило: `.cursor/rules/wallet.mdc`.
- **Вкладка «Рейтинг»:** код и кэш `rating` есть (топ-50 по `reputation`, `listRatingTop` / `rating_leaderboard.sql`); **сейчас UI off** — `RATING_TAB_ENABLED = false` в [`src/config/home.js`](src/config/home.js) (таб скрыт, `?tab=rating` → feed). Учёт reputation / чип не зависят от флага. Вернуть → `true`.
- **«Топы в сети»:** fixed-чип слева снизу (`legendary-online-panel` + heartbeat/list RPC); скрыт, если никого нет.
- **Deep links home:** `/home`, `?filter=completed` (Чужие / уже отревьюено), `?tab=mine`, `?tab=mine&filter=completed`; `?tab=rating` при выключенном флаге ремапится в feed. Query канонизирует `homeRoute.js`, Back/Forward переключает вид без remount.
- **Таймер:** `src/config/review.js` → `REVIEW_SESSION_SECONDS = 60` (review shell + intro copy). iframe — пауза при скрытой вкладке; external — wall-clock без паузы; конец → `src/assets/audio/Timer-end.wav` + стоп надиктовки (+ polish notes, если `POLISH_ENABLED`) → quiz.
- **Tabbar dock:** glass-таббар + кнопка «Закинуть своё» справа (56×56, Google blue, gap 8px); hide при скролле уезжает весь док. Светлый трек — gray-900 10% + blur 20; тёмный превью → `--on-dark` — white 20%.
- **Чипы шапки:** репутация → баланс → аватар. Submit и уведомления из topbar убраны.
- **Точка на «Чужие посты»:** красная 6px в углу вкладки при **новом** кейсе в open-ленте; открытие «Чужие посты» гасит (`feedSeen`), новый id снова зажигает.
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
| **Telegram** | Login Widget → `signInWithTelegram` | Edge Function `telegram-auth` → `verifyOtp` |
| **Google** | `signInWithGoogle` (OAuth PKCE) | Callback URL → `completeOAuthFromUrl` в `main.js` |
| **Email OTP** | UI **скрыт** (`EMAIL_AUTH_ENABLED = false`). API `requestEmailOtp` / `verifyEmailOtp` + `/registration/code` остаются; deep link без флага → `/registration` | Supabase Auth Email (вернуть: флаг `true` + SMTP + шаблоны `{{ .Token }}`) |

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
| Шаринг | home → аватар → account-menu → «Пригласить» (`homeInvite*`): copy + кастомное меню Telegram / X / Threads / LinkedIn (полный `homeInviteMessage`: `{url}`, `{code}`). «Сообщество» → [`t.me/obratka_dsgn`](https://t.me/obratka_dsgn) (`TELEGRAM_COMMUNITY_URL`) |
| SQL / API | [`supabase/sql/referrals.sql`](supabase/sql/referrals.sql), [`src/api/referrals.js`](src/api/referrals.js), [`src/utils/inviteGate.js`](src/utils/inviteGate.js) |

## Данные (Supabase)

| Сущность | Файл / роль |
|----------|-------------|
| `auth.users` | Supabase Auth |
| `public.profiles` | 1:1 с user; онбординг, баланс, `reputation`, tier, ban, `referral_code` (лимит 2), `workplace`; триггер `handle_new_user` |
| `public.referral_seed_codes` | bootstrap-коды (seed `YTHWKPDWAK`); только через RPC |
| `public.portfolios` / `reviews` | очередь ревью с матчингом по лиге грейда; `portfolios.completed_at` — старт окна жалобы / settle |
| `public.review_complaints` | жалобы автора (1 тег, окно 6ч от done) → −20 / +10 settle → автобан при `reputation <= -100` |
| `public.subscribers` | legacy waitlist; клиент удалён — таблица в БД может остаться до операторского drop |
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

## Встраивание портфолио (iframe / external)

На `/review` URL — iframe или UI «Открыть и начать» (`embedBlocked*`: видео-слот + 4 шага + CTA).

| Стратегия | Когда |
|-----------|--------|
| Спец-embed | Figma → `embed.figma.com?embed-host=obratka`; YouTube → `/embed/{id}` |
| External | суффикс в `EXTERNAL_EMBED_HOSTS` (Behance, Notion, Readymag, Tilda.ws, Wixsite, `vercel.app`, …) |
| Optimistic iframe | остальное (Dprofile, `*.framer.ai`, `*.webflow.io`, кастомные домены, Carrd, GitHub Pages…) |

Optimistic доп.: HTML-probe Readymag (CORS best-effort) + blank/error фрейма (XFO/CSP/сеть) → external + сброс таймера до кнопки.  
SoT: [`content/embed-hosts.md`](content/embed-hosts.md) ← `embedHosts.js` / `portfolioEmbed.js` / `main.js`.  
Иконка площадки (`platformBrandIcon.js`) **≠** embed-стратегия.

## Репутация и жалобы на листы

Цель: ловить халяву / спам / травлю / нецелевое, не превращая обиду на жёсткую критику в бан.

| Что | Детали |
|-----|--------|
| Где UI | `/report` — список листов; «Посмотреть» → side-panel → «Пожаловаться» → модалка (1 тег). Без жалобы = ок; окно **6ч от `completed_at`** (момент done); вне окна кнопку жалобы скрывать |
| Теги v1 | `low_effort`, `spam`, `harassment`, `offensive`, `ai_slop` (веса только в SQL) |
| Штраф / плюс | жалоба = −20 (1 тег); старт `0`; бан при `<= -100`; +10 после окна без жалобы (settle тоже от done) |
| Ревьюер | чип = абсолют без плюса (`100` / `0` / `-20`) + explainer **без** таблицы весов |
| Публичный топ | API `listRatingTop` / `rating_leaderboard.sql` живы; **вкладка UI off** (`RATING_TAB_ENABLED = false`); `?tab=rating` → лента. Чип репутации и иконки positive/neutral/negative работают |
| Апелляция | вручную («Связаться» на `/banned`) |
| SQL / API | [`review_complaints.sql`](supabase/sql/review_complaints.sql), [`reviewComplaints.js`](src/api/reviewComplaints.js) |

**Вне v1:** `misleading`, очередь модерации, троттлинг жалобщиков, влияние на лиги.

## Слои UI

| Слой | Где |
|------|-----|
| Brand split (referral / auth / auth-code / onboarding / url) | `.url-screen*` + [`brand-screen-visual`](src/components/brand-screen-visual/README.md) + [`brand-screen-shell`](src/components/brand-screen-shell/README.md); на `/portfolio` — back-chip top-left |
| Field errors | [`FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) — текст + обводка; visual `invalid` |
| App modal | [`app-modal`](src/components/app-modal/README.md) — общий диалог (слот контента + primary/secondary); Figma Modal |
| Side panel | [`side-panel`](src/components/side-panel/README.md) — панель справа (слот); home → «Правила» |
| Home | `home-screen` + `account-menu` + `tabs-panel` + `legendary-online-panel` + `feedback`; feed/mine (+ кэш `rating`, таб UI off); URL-query; лента SWR (`feed`/`feedReviewed`/`mine`/`rating`); Ждёт/Уже + Ещё/Завершенные; tabbar-dock (tabs + submit + точки feedSeen / 3/3) / `--on-dark` / entrance cascade |
| Review | `index.html` `.iframe-shell` + таймер + чип **rec** (заметки → `answers.dictation`; polish off/`POLISH_ENABLED`) в `main.js`; embed: `resolvePortfolioEmbed` / external UI |
| Quiz | `review-screen` + `review-panel` + [`scale-slider`](src/components/scale-slider/README.md) (context/visual **1–5**; условный `pain`; рыночный `tier`) + mic → `advice`. SoT: [`QUIZ.md`](QUIZ.md) |
| Success | `success-screen` (`/done`) |
| Ban | `ban-screen` — статичный красный mesh + `banBrandMarkSvg` |
| Report | `report-screen` — листы (+ надиктовка) → просмотр в side-panel → жалоба + PDF |
| Settings | `settings-screen` (`/settings`, side-panel поверх home, view-only) |

Handoff соседних brand-экранов: `go(id, { handoff: true })` — правый visual без повторной анимации.

Visual variants: `default` / `invalid` (рожки без resize) / `done` (logo-angel). Подробно — README `brand-screen-visual`.

## Квиз и отчёт

Пул вопросов после `/review` → `/quiz`, схема `reviews.answers`, зоны шкал, L1/L2/L3 PDF и условный `pain` — **[`QUIZ.md`](QUIZ.md)**.

Кратко:

- Шкалы **context** и **visual** обе **1–5** ([`scale-slider`](src/components/scale-slider/README.md)).
- `pain[]` показывается только при `visual ≤ 2` (composition / contrast / components / overloaded).
- Вердикт рынка — поле **`tier`** (`early` · `mid` · `strong` · `top`), не `hire`.
- Отчёт: `buildReportSections` в [`reviewReport.js`](src/utils/reviewReport.js); preview без кросс-сигналов; full — L2 + матрица `tier × gradeZone` + `reportSummaryLead`.
- `advice` / `dictation` — текст юзера; post-edit пунктуации через Edge [`polish-dictation`](supabase/functions/polish-dictation/README.md) **сейчас выключен** клиентским `POLISH_ENABLED = false` в [`dictationPolish.js`](src/api/dictationPolish.js) (вернуть `true` чтобы снова; soft-fail → сырой текст). L1/L2/L3 по-прежнему детерминированные, без LLM.
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

- CSS: `tokens`, `base`, `entrance`, `app-modal`, `side-panel`, `iframe-shell`, `success-screen`, `home-screen`, `legendary-online-panel`, `feedback`, `tabs-panel`, `account-menu`, `settings-screen`, `ban-screen`, `report-screen` (+ `desktop-only-screen` через импорт фабрики)
- Экраны: referral, auth, auth-code, onboarding, home, settings, url, review-shell (+ rec), quiz, success, report, ban, not-found
- Shared UI: `brand-screen-visual`, `brand-screen-shell`, `app-modal`, `side-panel`, `account-menu`, `tabs-panel`, `legendary-online-panel`, `feedback`, `scale-slider`, `desktop-only-screen` (гейт &lt;768px)
- Home state: `src/utils/homeRoute.js` (query) + `homeListCache.js` + `feedSeen.js` + `mineReadySeen.js` (кэши сбрасываются в `exitAuthenticatedSession`)
- Review timer: `src/config/review.js` (`REVIEW_SESSION_SECONDS`); iframe pause / external wall-clock; end sound `src/assets/audio/Timer-end.wav`
- Portfolio embed: `src/utils/embedHosts.js` + `portfolioEmbed.js` + Edge `portfolio-embed-probe` (XFO/CSP; Figma/YouTube rewrite; blocklist → external; optimistic iframe + Readymag probe + frame-block fallback). Каталог: [`content/embed-hosts.md`](content/embed-hosts.md)
- Dictation: `src/lib/dictation/` (Web Speech MVP; external `setKeepAliveInBackground`); post-edit — Edge [`polish-dictation`](supabase/functions/polish-dictation/README.md) + [`dictationPolish.js`](src/api/dictationPolish.js) (`ZAI_API_KEY` только в secrets; soft-fail → сырой текст; **сейчас `POLISH_ENABLED = false`**)
- Url-screen: чип «На главную» (`.url-screen__back`, скрыт на done) → `onExit` → home
- Desktop-only: [`mobile.md`](mobile.md) + [`desktop-only-screen`](src/components/desktop-only-screen/README.md) + [`viewport.js`](src/utils/viewport.js)
- Report consensus PDF: [`ACTION_CARDS.md`](ACTION_CARDS.md) — `actionCards.json` (триггеры) + `actionResources.json` (URL / covers) → `resolveActionCards` → `shareConsensusPdf`
- Landing: отдельный Vite entry [`landing/`](landing/README.md) (`dist/landing/`); CTA Telegram-first (`t.me/obratka_dsgn`); `?ref=` → `/referral`; после gate → `/registration`; без api/session

Waitlist dual-layout удалён; историческая спека — [`mobile.md`](mobile.md) § Архив.

## Env (кратко)

| Где | Что |
|-----|-----|
| `.env` | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TELEGRAM_BOT_ID` (+ optional username), `VITE_BASE_PATH`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` |
| Dashboard Auth | Google OAuth, Redirect URLs (Email OTP — когда вернём UI) |
| Edge secrets | `TELEGRAM_BOT_TOKEN`, `ZAI_API_KEY` (опц. `ZAI_MODEL` / `ZAI_MODEL_FALLBACK` для polish-dictation; default `glm-4.5-flash`; клиентский invoke сейчас off — `POLISH_ENABLED`) |

## Аналитика (PostHog)

Клиентский PostHog: [`src/lib/analytics.js`](src/lib/analytics.js) — pageviews из `applyRoute`, product-события воронки (referral → auth → onboarding → claim → submit).  
SoT имён и чеклист «новая фича = аналитика»: [`ANALYTICS.md`](ANALYTICS.md). Правило агента: `.cursor/rules/analytics.mdc`.

## Roadmap (код)

1. Вынести общие split-стили в `brand-screen.css` (классы пока `.url-screen*`).
2. Manual identity linking UI (`linkIdentity`) + UNIQUE `profiles.email` + склейка Telegram↔email — вне текущего скоупа.  
   Email↔Google закрывается **Automatic linking** в Supabase Auth (verified email = один user); см. [`auth-screen/README.md`](src/components/auth-screen/README.md).
3. Троттлинг злоупотреблений жалобой / тег `misleading` / очередь модерации.
4. Редизайн жалоб / списка листов на `report-screen` (PDF-сводка уже есть).
5. Диктовка план B: Whisper через Edge (контракт `DictationEngine` уже есть; MVP = Web Speech). Post-edit пунктуации wired, но **клиент off** (`POLISH_ENABLED = false`) — [`polish-dictation`](supabase/functions/polish-dictation/README.md).
6. Добить step-events онбординга и квиза (`onboarding_step_*`, `quiz_step_completed`) — имена в [`ANALYTICS.md`](ANALYTICS.md) § планируемые. Intro / timer / next case / home submit / auth start·fail уже wired.

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
