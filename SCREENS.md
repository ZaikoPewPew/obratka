# Экраны приложения — архитектура

Карта экранов «Обратки», path-роутинг и ветки с Home.

Статус: **продуктовый флоу wired**. Auth: **Telegram + Google** → `profiles` (Email OTP — UI off, `EMAIL_AUTH_ENABLED = false`). Onboarding пишет в Supabase. Home — очередь `portfolios`/`reviews` по лиге грейда + баланс из `profiles`. Вкладка «Рейтинг» **скрыта** (`RATING_TAB_ENABLED = false`). Submit URL — done на url-screen; success — пресеты / deep link.

## Продуктовый флоу

```text
referral → auth → (authCode) → onboarding → home
                              ├─ tabs → feed / mine  (rating UI off)
                              ├─ profile → settings
                              ├─ pick → intro-модалка → claim → review → quiz → /quiz/done
                              │         («На главную» → home; «Следующий кейс» → claim следующего → review)
                              ├─ mine card → report (все ревью собраны) / модалка (ещё нет)
                              └─ submit (url) → done на url-screen → /done (URL sync)
```

| Шаг | Экран | Path | Смысл |
|-----|--------|------|--------|
| 1 | `referral-screen` | `/referral` | Реферальный код (validate RPC; seed `YTHWKPDWAK`); стек аватаров — random из `founder-avatars.json` |
| 2 | `auth-screen` | `/registration` | Telegram / Google (Email OTP скрыт: `EMAIL_AUTH_ENABLED = false`) |
| 2b | `auth-code-screen` | `/registration/code` | 6 ячеек кода из письма; без гейта → `/referral`; с гейтом и email off → `/registration` |
| 3 | `onboarding-screen` | `/onboarding` | Вопросы профиля → `profiles` |
| 4 | `home-screen` | `/home` + query | Хаб: feed/mine (рейтинг UI off, `?tab=rating` → feed); SWR + intro до claim + mine report gate + tabbar-dock (entrance / glass / `--on-dark`); query хранит активный вид |
| 4a | `settings-screen` | `/settings` | Профиль (view-only) в side-panel поверх home; sticky header, без Save |
| 5a | iframe-shell | `/review` | Ревью: iframe + таймер **60 s** (pause / external wall-clock + `Timer-end.wav`) + чип **rec** + «Прервать ревью» |
| 5b | `url-screen` | `/portfolio` | Подача URL (баланс); чип «На главную»; done на том же экране |
| 6 | `review-screen` + `review-panel` + `scale-slider` | `/quiz` → `/quiz/done` | Квиз: grade → context/structure/metrics → visual 1–5 (+ pain если ≤2) → **tier** → advice; финал + улет отчёта. SoT: [`QUIZ.md`](QUIZ.md) |
| 7 | `success-screen` | `/done` | Успех подачи: тайтл + «Выйти», зелёный mesh справа |
| 8 | `report-screen` | `/report` | Отчёт автору: листы → «Посмотреть» (side-panel) → жалоба (1 тег, окно 6ч от done; вне окна кнопку скрывать) + PDF (мокап листа → done после скачивания) |
| — | `ban-screen` | `/banned` | Аккаунт заблокирован; «Выйти» + «Связаться» (242px); красный mesh; deep link escape-proof |
| — | `not-found-screen` | `/404` | Неизвестный path; тайтл + «На главную» → `/home` или `/registration` |
| — | `desktop-only-screen` | *(оверлей)* | Viewport &lt; 768px: «только с компьютера»; не маршрут; см. [`mobile.md`](mobile.md) |

Корень `/` → `resolveEntryScreen(getSession())`. Query (`?ref=`, `?lang=`) сохраняются. Неизвестный path (не `/` и не в карте) → `/404` (`notFound`), не entry.

- **Google return:** hash/query → `completeOAuthFromUrl()` в `main.js` → onboarding / home.
- **Telegram / Google:** остаются на `/registration` до `onSuccess` → `applyProviderUser`. Email OTP UI скрыт; экран кода жив при `EMAIL_AUTH_ENABLED`.
- **Auth gate:** `home/settings/onboarding/report/url/success/review/quiz/done` без сессии → referral/auth; с сессией без завершённого онбординга → `/onboarding`.
- **Stale session:** cached `userId` на boot сверяется с Supabase Auth; без живого user очищается UX-кэш с сохранением referral-кода.
- **Ban:** `profiles.banned_at` → всегда `/banned` (login, boot, любой deep link).
  Операторская шпаргалка: [`supabase/BAN.md`](supabase/BAN.md), шаблоны SQL: [`supabase/sql/ban-templates.sql`](supabase/sql/ban-templates.sql).
- **Desktop-only:** viewport &lt; 768px → оверлей `desktop-only-screen` (не path); ревью/claim не стартуют. Спека: [`mobile.md`](mobile.md).

SPA-fallback для GitHub Pages: `npm run build` копирует `dist/index.html` → `dist/404.html` (entry для deep links). Продуктовый «не найдено» — экран `notFound` на `/404`, не статическая замена `404.html`.

## Auth на `/registration`

| Способ | UX | API |
|--------|-----|-----|
| Telegram | виджет → сессия | `signInWithTelegram` |
| Google | редирект OAuth | `signInWithGoogle` |
| Email | **скрыт** (`EMAIL_AUTH_ENABLED = false`). При флаге: email → `/registration/code` (6 ячеек) → сессия; resend cooldown 60s | `requestEmailOtp` / `verifyEmailOtp` |

Пароль и обязательный magic-link в UI **не** используются. Setup Dashboard: `src/components/auth-screen/README.md`.

### Защита пользователей

- **Automatic linking** (Supabase): Email ↔ Google с одной verified email → один аккаунт. Telegram не склеивается.
- **OTP anti-abuse:** cooldown resend (`--auth-code-resend-cooldown`) + чужой rate-limit Auth.
- **Ошибки:** `auth_identity_conflict` / `email_otp_rate_limit` → i18n на auth / auth-code.
- **Не делать в коде:** свою «валидацию email против Google»; Manual linking UI — roadmap.

Подробнее: [`auth-screen/README.md`](src/components/auth-screen/README.md), [`auth-code-screen/README.md`](src/components/auth-code-screen/README.md), [`src/api/README.md`](src/api/README.md).

## Визуальная база

Экраны **referral / auth / auth-code / onboarding / url** — split-layout.

| Зона | Классы / модуль | Поведение |
|------|-----------------|-----------|
| Корень | `.url-screen` (цель: `brand-screen`) | open/close + transition |
| Левая | `__form-pane` | контент экрана |
| Правая | [`brand-screen-visual`](src/components/brand-screen-visual/README.md) | mesh + noise + марка |

### Варианты правого visual (`setVariant`)

| Variant | Когда | Mesh | Марка |
|---------|--------|------|-------|
| `default` | обычное состояние | `--url-screen-mesh-*` | blob 44×49 |
| `invalid` | ошибка поля / OTP / provider | `--url-screen-error-mesh-*` (ban) | рожки fade-in, **без** resize SVG |
| `done` | submit URL (url-screen) | `--shell-review-mesh-done-*` | logo-angel (52×59) |

Ошибка поля (текст + обводка): [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md)  
(`setUrlScreenFieldInvalid` / `setUrlScreenOtpInvalid` + `setVariant("invalid")`).

Handoff соседних brand-экранов: `handoff: true` (`brandScreenTransition.js`) — правый visual не переигрывается.

`home-screen` — полноэкранный слой (absolute topbar поверх ленты); вкладки Чужие/Мои (рейтинг — код/кэш есть, **UI off** `RATING_TAB_ENABLED = false`, `?tab=rating` → feed); SWR `homeListCache` (`feed`/`feedReviewed`/`mine`/`rating`); fixed-чип «Топы в сети» (`legendary-online-panel`, слева снизу, скрыт если никого нет); FAB feedback (`feedback`, Telegram); toast `notification` (нет уток / слот занят); intro до claim (`homeReviewIntro*`); на feed — сегмент «Ждёт ревью / Уже отревьюено» (`tabs-panel`; reviewed → `listReviewedPortfolios`, серое превью + `homeCardReviewedLabel` / `report-sent.svg`, слоты ревьюеров обычные); open-лента без `reviewedByMe`; mine report gate (`homeMineNotReady*`); на mine — «Ещё на ревью / Завершенные»; free-slot «Ещё на ревью» до `MAX_MINE_PENDING` (=1) (`homeMineSlotFree*` / toast `homeNotifySlotTaken`); нет монет → toast `homeNotifyNoDucks` + buzz submit + чип баланса; точка на «Чужие посты» при новом кейсе (`feedSeen` / `homeTabFeedNewAria`); точка на «Мои» и «Завершенные» при непросмотренном 3/3 (`mineReadySeen` / `homeTabMineReadyAria`); tabbar-dock (glass tabs + кнопка submit справа, hide вместе); контраст (`backdropLuminance` → `--on-dark`); entrance cascade на `--open` (`--home-screen-reveal-delay-*`, dock = `motion-reveal-dock` без opacity).
`account-menu` — поповер под аватаром; identity read-only; «Профиль» / «Пригласить» (copy + меню Telegram / X / Threads / LinkedIn, полный `homeInviteMessage`) / «Сообщество» (`TELEGRAM_COMMUNITY_URL`) / «Правила» / «Выйти».
`side-panel` — боковая панель справа (home → «Правила», Figma `517:4740`); слот контента; без `history` / `go()`.  
`settings-screen` — side-panel поверх home на `/settings` (все поля view-only; двухколоночный лейаут; дата создания в description; без Save).
`url-screen` — split; чип «На главную» (`.url-screen__back` / `urlScreenBack*`, скрыт на done); при URL справа заглушка «Портфолио»; submit → done на том же экране (`setVariant("done")`).  
`success-screen` — запасной `/done` (deep link); основной submit больше не прыгает сюда (`pendingSuccessPreset` = `generic`).  
`review-screen` — split для квиза (слева panel, справа visual + PDF-лист).  
Шкалы context/visual **1–5** — [`scale-slider`](src/components/scale-slider/README.md). Пул / `tier` / отчёт — [`QUIZ.md`](QUIZ.md).  
`ban-screen` — статичный красный mesh + `banBrandMarkSvg` (не `setVariant`).  
На `/review` в шапке — опциональная надиктовка (`.iframe-shell__rec`), в квизе — микрофон в поле «Главный совет» (`.review-panel__rec`); таймер `REVIEW_SESSION_SECONDS` из [`src/config/review.js`](src/config/review.js).  
Embed: [`content/embed-hosts.md`](content/embed-hosts.md) — спец-embed / blocklist / optimistic + Readymag probe + iframe→external fallback (`embedBlocked*`).  
iframe: пауза при скрытой вкладке; external (портфолио в другой вкладке): wall-clock без паузы + best-effort keep-alive STT; конец → `Timer-end.wav` + стоп записи → quiz.  
После stop / перед submit — post-edit пунктуации (Edge `polish-dictation`, не STT; **сейчас клиент off** — `POLISH_ENABLED = false`). См. [`src/lib/dictation/README.md`](src/lib/dictation/README.md), [`supabase/functions/polish-dictation/README.md`](supabase/functions/polish-dictation/README.md).

## Дерево файлов

```text
SCREENS.md

src/app/
  routes.js / router.js / flow.js / session.js
  README.md

src/components/
  brand-screen-shell/     ← каркас split + visual
  brand-screen-visual/    ← mesh + марка, variants
  app-modal/              ← универсальная модалка (слот + CTA)
  side-panel/             ← боковая панель справа (слот; «Правила»)
  tabs-panel/             ← сегмент feed/mine (Figma tabspanel)
  referral-screen/
  auth-screen/
  auth-code-screen/
  onboarding-screen/
  home-screen/
  legendary-online-panel/ ← fixed-чип «Топы в сети» (слева снизу)
  feedback/            ← fixed FAB feedback (Telegram)
  notification/        ← toast top-right (нет уток / слот занят)
  account-menu/          ← поповер профиля под аватаром
  settings-screen/       ← /settings (side-panel поверх home)
  url-screen/
  review-screen/
  review-panel/           ← шаги квиза
  scale-slider/           ← шкалы context (1–5) / visual (1–5)
  success-screen/         ← /done (подача портфолио)
  report-screen/          ← /report (листы → side-panel → жалоба; сводный PDF)
  ban-screen/             ← /banned (аккаунт заблокирован)
  not-found-screen/       ← /404 (неизвестный path)
  desktop-only-screen/    ← оверлей <768px (не path; см. mobile.md)
  rating/                 ← неиспользуемый aside (вкладка рейтинга — в home-screen; UI off)

landing/                  ← промо MPA entry (без api/session)

src/data/
  actionCards.json        ← карточки проблем (без URL)
  actionResources.json    ← источники → covers card ids

src/utils/
  FIELD_ERROR.md          ← fieldError + urlScreenField
  fieldError.js / urlScreenField.js
  brandScreenTransition.js / meshGradientWash.js / motionTokens.js
  backdropLuminance.js    ← яркость фона под tabbar → --on-dark
  viewport.js             ← DESKTOP_MIN_WIDTH_PX (768) + matchMedia
  homeRoute.js            ← /home query ↔ feed/mine/rating + mine filter
  homeListCache.js        ← SWR feed/feedReviewed/mine/rating (memory + sessionStorage)
  feedSeen.js             ← seen id open-ленты → точка на «Чужие посты»
  mineReadySeen.js        ← seen id готовых отчётов → точка на «Мои» / «Завершенные»
  reviewReport.js         ← answers → секции PDF (tier × gradeZone, L1/L2/L3; см. QUIZ.md)
  aggregatePortfolioReviews.js / resolveActionCards.js / buildConsensusReport.js / shareConsensusPdf.js
                          ← сводный PDF + action cards (см. ACTION_CARDS.md)

src/config/
  review.js               ← REVIEW_SESSION_SECONDS (таймер /review + intro)
  contacts.js             ← community Telegram URL

src/lib/
  supabaseClient.js
  dictation/              ← DictationEngine (Web Speech MVP; закладка Whisper)

src/assets/brand/
  logo-default.svg / logo-devil.svg / logo-angel.svg
  brandMarks.js / logoDonePaths.js  ← SVG + morph (evil без resize / angel done)

src/api/
  auth.js / profiles.js / onboarding.js / wallet.js
  portfolios.js / leagues.js / referrals.js / reviewComplaints.js
  presence.js / rating.js
  dictationPolish.js      ← Edge polish-dictation (пунктуация; не STT; POLISH_ENABLED=false)
  telegramWidget.js
  portfolioEmbedProbe.js

styles/
  tokens.css
  entrance.css
  app-modal.css
  side-panel.css
  iframe-shell.css
  home-screen.css
  legendary-online-panel.css
  feedback.css
  notification.css
  tabs-panel.css
  account-menu.css
  settings-screen.css
  success-screen.css
  report-screen.css
  ban-screen.css

content/
  locales.json
  onboarding.json / onboarding.md
```

## Контракты

Паттерн: фабрика → `{ root, open, close, … }`. Монтаж и URL — из `main.js` (`go` / `applyRoute`). Компонент **не** знает следующий экран.

Shared (не экраны флоу):

| Фабрика | Роль |
|---------|------|
| `createBrandScreenShell` | split form + visual |
| `createBrandScreenVisual` | mesh + марка |
| `createAppModal` | оверлей-диалог; слот `content` + primary/secondary; без `history` |
| `createTabsPanel` | сегмент табов (feed: Ждёт/Уже; mine: Ещё/Завершенные) |

| Фабрика | Path | Статус |
|---------|------|--------|
| `createReferralScreen` | `/referral` | UI + validate; field invalid + visual (shell) |
| `createAuthScreen` | `/registration` | UI + Telegram / Google (Email OTP скрыт флагом; shell) |
| `createAuthCodeScreen` | `/registration/code` | UI + OTP; `setUrlScreenOtpInvalid` (shell); без гейта → `/referral`; email off → `/registration` |
| `createOnboardingScreen` | `/onboarding` | UI → profiles (shell) |
| `createHomeScreen` | `/home` + query | UI (Чужие/Мои; рейтинг UI off + SWR + intro + mine gate + Ждёт/Уже + Ещё/Завершенные + free-slot + feedSeen/3/3 + «Топы в сети» + feedback + tabbar-dock + entrance cascade) |
| `createSettingsScreen` | `/settings` | Side-panel профиля (view-only) |
| `createUrlScreen` | `/portfolio` | UI (back-chip → home; submit + done via `setVariant`; shell) |
| iframe-shell + timer + rec | `/review` | UI (заметки → `answers.dictation`) |
| `createReviewScreen` + `createReviewPanel` (+ `createScaleSlider`) | `/quiz` | UI: visual 1–5, условный pain, `tier`; mic → `advice`. См. [`QUIZ.md`](QUIZ.md) |
| `createSuccessScreen` | `/done` | UI (deep link / generic; submit остаётся на url-screen) |
| `createReportScreen` | `/report` | UI (листы → просмотр → жалоба на лист) |
| `createBanScreen` | `/banned` | UI (блок аккаунта; static evil mark) |
| `createNotFoundScreen` | `/404` | UI (мусорный path; CTA → home / registration) |

### Handoff

```js
go("auth", { handoff: true }); // referral → auth: visual статичен
```

## Стили / motion

Токены: `styles/tokens.css`. Reveal: `--motion-*`, keyframes в `entrance.css` (в т.ч. `motion-reveal-topbar`, `motion-reveal-dock`), JS `motionTokens.js`.  
Field error: `--motion-field-error-*`, `--motion-field-error-visual-*`.  
Auth: `--auth-screen-*`, `--auth-code-*` (в т.ч. `--auth-code-resend-cooldown`).  
App modal: `--app-modal-*` + `styles/app-modal.css` ([`app-modal/README.md`](src/components/app-modal/README.md)).  
Side panel: `--side-panel-*` + `styles/side-panel.css` ([`side-panel/README.md`](src/components/side-panel/README.md)).  
Tabs panel: `--tabs-panel-*` + `styles/tabs-panel.css` ([`tabs-panel/README.md`](src/components/tabs-panel/README.md)).  
Home tabbar-dock: `--home-screen-tabbar-*` + `--home-screen-tabbar-dock-gap` / `--home-screen-tabbar-submit-*` (translucent track / on-dark / blur / contrast; кнопка «Закинуть своё» 56×56 Google blue).  
Home entrance: `--home-screen-reveal-delay-*` + `motion-reveal-dock` (только translate; **без** opacity на dock — иначе ломается glass `backdrop-filter` у `.home-screen__tabbar`).  
Правило: `.cursor/rules/design-tokens.mdc`.

## i18n

Все UI-строки — `content/locales.json` (`referral*`, `homeInvite*` / `homeNoSlots*` / `homeAlreadyReviewed*` / `homeReviewIntro*` / `homeMineNotReady*` / `homeFeedFilter*` / `homeMineFilter*` / `homeEmptyMineActive` / `homeEmptyMineCompleted` / `homeEmptyFeedReviewed` / `homeCardReviewedLabel` / `homeCardReport*` / `homeCardReportPending*` / `homeCardMinePendingRole` / `homeTabMineReadyAria` / `homeReputation*` / `homeBalance*`, `auth*` / `authCode*` / `authOtp*` / `authIdentityConflict`, `onboarding*`, `home*`, `modalCloseAria`, `url*` / `urlScreenBack*`, `success*`, `reportScreen*` / `reportComplaint*` / `complaintTag*`, `review*` / `reviewRec*` / `reviewAdviceRec*` / `reviewContextShort`·`Value*`·`Hint*` / `reviewVisualShort`·`Value*`·`Hint*` / `report*` / `reportDictationTitle`, `frame*` / `controls*`).
Правило: `.cursor/rules/i18n.mdc`.

Таймер `/review` и intro copy: `REVIEW_SESSION_SECONDS` в [`src/config/review.js`](src/config/review.js).  
Embed-стратегия: [`content/embed-hosts.md`](content/embed-hosts.md).  
iframe — пауза при `visibility hidden`; external — wall-clock + дедлайн; конец → [`Timer-end.wav`](src/assets/audio/Timer-end.wav).

## App-слой

| Файл | Роль |
|------|------|
| `routes.js` | id ↔ path |
| `router.js` | History API + `BASE_URL` |
| `flow.js` | порядок, entry, auth/onboarding gates и deep-link access |
| `session.js` | login-сессия + balance + referral fields в localStorage (`obratka.session`) — **не** путать с `/review` |

## API

`src/api/` — Auth (Telegram / Google + Email OTP API при флаге + `mapSupabaseAuthErrorCode`), profiles, referrals (validate/redeem), onboarding, wallet sync, shared portfolios queue. См. `src/api/README.md`.

## Дальше

1. Вынести CSS в `brand-screen.css` (классы пока `.url-screen*`).
2. Manual identity linking (`linkIdentity`) + UNIQUE `profiles.email` + Telegram↔email — вне текущего скоупа.
3. Троттлинг злоупотреблений жалобой / тег `misleading` / очередь модерации.
4. Редизайн жалоб / списка листов на `report-screen` (PDF уже есть).
5. Диктовка: post-edit пунктуации wired (`polish-dictation`), **клиент off** (`POLISH_ENABLED = false`); план B Whisper Edge — контракт готов, MVP = Web Speech.

## Связанные документы

- [`STRUCTURE.md`](STRUCTURE.md)
- [`PROJECT.md`](PROJECT.md)
- [`src/app/README.md`](src/app/README.md)
- [`src/components/home-screen/README.md`](src/components/home-screen/README.md) — feed/mine (рейтинг UI off), URL-query, SWR, intro до claim, mine gate, feedSeen/3/3, «Топы в сети», contact FAB, tabbar-dock, entrance cascade / glass / `--on-dark`
- [`src/components/legendary-online-panel/README.md`](src/components/legendary-online-panel/README.md) — fixed-чип «Топы в сети»
- [`src/components/feedback/README.md`](src/components/feedback/README.md) — fixed FAB feedback (Telegram)
- [`src/components/notification/README.md`](src/components/notification/README.md) — toast (нет уток / слот занят)
- [`src/api/rating.js`](src/api/rating.js) — `listRatingTop` (топ-50 по репутации)
- [`src/components/url-screen/README.md`](src/components/url-screen/README.md) — back-chip + done
- [`src/config/review.js`](src/config/review.js) — `REVIEW_SESSION_SECONDS`
- [`src/utils/homeListCache.js`](src/utils/homeListCache.js) — кэш вкладок home
- [`src/utils/homeRoute.js`](src/utils/homeRoute.js) — parse/build/canonical home query
- [`src/utils/feedSeen.js`](src/utils/feedSeen.js) — seen кейсов open-ленты → точка на «Чужие посты»
- [`src/utils/mineReadySeen.js`](src/utils/mineReadySeen.js) — seen 3/3 → точка на «Мои» / «Завершенные»
- [`QUIZ.md`](QUIZ.md) — пул вопросов, схема `answers`, L1/L2/L3 PDF
- [`src/components/scale-slider/README.md`](src/components/scale-slider/README.md) — шкалы квиза 1–5 (canvas, nearest, hover-превью ступеней)
- [`src/lib/dictation/README.md`](src/lib/dictation/README.md) — надиктовка: `/review` + поле совета в квизе; iframe pause / external keep-alive; конец → [`Timer-end.wav`](src/assets/audio/Timer-end.wav); post-edit → [`polish-dictation`](supabase/functions/polish-dictation/README.md) (клиентский kill-switch)
- [`src/components/brand-screen-visual/README.md`](src/components/brand-screen-visual/README.md) — правый visual + variants
- [`src/components/brand-screen-shell/README.md`](src/components/brand-screen-shell/README.md) — split-каркас
- [`src/components/app-modal/README.md`](src/components/app-modal/README.md) — универсальная модалка
- [`src/components/side-panel/README.md`](src/components/side-panel/README.md) — боковая панель
- [`src/components/tabs-panel/README.md`](src/components/tabs-panel/README.md) — сегмент табов
- [`src/components/desktop-only-screen/README.md`](src/components/desktop-only-screen/README.md) — гейт &lt;768px («только с компьютера»)
- [`src/components/not-found-screen/README.md`](src/components/not-found-screen/README.md) — SPA `/404`
- [`mobile.md`](mobile.md) — политика desktop-only + QA + архив waitlist
- [`landing/README.md`](landing/README.md) — промо MPA (CTA Telegram-first)
- [`ACTION_CARDS.md`](ACTION_CARDS.md) — сводный PDF + action cards / resources
- [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) — ошибки полей
- [`src/assets/README.md`](src/assets/README.md) — марки / morph
- [`src/components/auth-screen/README.md`](src/components/auth-screen/README.md)
- [`src/components/auth-code-screen/README.md`](src/components/auth-code-screen/README.md)
- [`content/onboarding.md`](content/onboarding.md)
- [`.cursor/README.md`](.cursor/README.md)
