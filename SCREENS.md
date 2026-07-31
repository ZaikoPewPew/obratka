# Экраны приложения — архитектура

Карта экранов «Обратки», path-роутинг и ветки с Home.

Статус: **продуктовый флоу wired**. Auth: **Email OTP + Telegram + Google** → `profiles`. Onboarding пишет в Supabase. Home — очередь `portfolios`/`reviews` по лиге грейда + баланс из `profiles`. Submit URL — done на url-screen; success — пресеты / deep link.

## Продуктовый флоу

```text
referral → auth → authCode → onboarding → home
                              ├─ tabs → feed / mine / rating
                              ├─ profile → settings
                              ├─ pick → intro-модалка → claim → review → quiz → /quiz/done
                              │         («На главную» → home; «Следующий кейс» → claim следующего → review)
                              ├─ mine card → report (все ревью собраны) / модалка (ещё нет)
                              └─ submit (url) → done на url-screen → /done (URL sync)
```

| Шаг | Экран | Path | Смысл |
|-----|--------|------|--------|
| 1 | `referral-screen` | `/referral` | Реферальный код (validate RPC; seed `YTHWKPDWAK`); стек аватаров — random из `founder-avatars.json` |
| 2 | `auth-screen` | `/registration` | Email → OTP screen / Telegram / Google |
| 2b | `auth-code-screen` | `/registration/code` | 6 ячеек кода из письма |
| 3 | `onboarding-screen` | `/onboarding` | Вопросы профиля → `profiles` |
| 4 | `home-screen` | `/home` + query | Хаб: feed/mine/rating; SWR + intro до claim + mine report gate + tabbar-dock (entrance / glass / `--on-dark`); query хранит активный вид |
| 4a | `settings-screen` | `/settings` | Профиль: имя, Telegram, профессия, workplace; email/grade/дата — read-only |
| 5a | iframe-shell | `/review` | Ревью: iframe + таймер **45 s** (pause / external wall-clock + `Timer-end.wav`) + чип **rec** + «Прервать ревью» |
| 5b | `url-screen` | `/portfolio` | Подача URL (баланс); чип «На главную»; done на том же экране |
| 6 | `review-screen` + `review-panel` + `scale-slider` | `/quiz` → `/quiz/done` | Квиз: grade → context/structure/metrics → visual 1–5 (+ pain если ≤2) → **tier** → advice; финал + улет отчёта. SoT: [`QUIZ.md`](QUIZ.md) |
| 7 | `success-screen` | `/done` | Успех подачи: тайтл + «Выйти», зелёный mesh справа |
| 8 | `report-screen` | `/report` | Отчёт автору: листы → «Посмотреть» (side-panel) → жалоба (1 тег, окно 6ч от done; вне окна кнопку скрывать) + PDF (мокап листа → done после скачивания) |
| — | `ban-screen` | `/banned` | Аккаунт заблокирован; «Выйти» + «Связаться» (242px); красный mesh; deep link escape-proof |

Корень `/` → `resolveEntryScreen(getSession())`. Query (`?ref=`, `?lang=`) сохраняются.

- **Google return:** hash/query → `completeOAuthFromUrl()` в `main.js` → onboarding / home.
- **Email OTP / Telegram:** остаются на `/registration` до `onSuccess` → `applyProviderUser`.
- **Auth gate:** `home/settings/onboarding/report/url/success/review/quiz/done` без сессии → referral/auth; с сессией без завершённого онбординга → `/onboarding`.
- **Stale session:** cached `userId` на boot сверяется с Supabase Auth; без живого user очищается UX-кэш с сохранением referral-кода.
- **Ban:** `profiles.banned_at` → всегда `/banned` (login, boot, любой deep link).
  Операторская шпаргалка: [`supabase/BAN.md`](supabase/BAN.md), шаблоны SQL: [`supabase/sql/ban-templates.sql`](supabase/sql/ban-templates.sql).

SPA-fallback для GitHub Pages: `npm run build` копирует `dist/index.html` → `dist/404.html`.

## Auth на `/registration`

| Способ | UX | API |
|--------|-----|-----|
| Email | email → `/registration/code` (6 ячеек) → сессия; resend с cooldown 60s | `requestEmailOtp` / `verifyEmailOtp` |
| Telegram | виджет → сессия | `signInWithTelegram` |
| Google | редирект OAuth | `signInWithGoogle` |

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
| `default` | обычное состояние | `--url-screen-mesh-*` | blob 44×43 |
| `invalid` | ошибка поля / OTP / provider | `--url-screen-error-mesh-*` (ban) | рожки fade-in, **без** resize SVG |
| `done` | submit URL (url-screen) | `--shell-review-mesh-done-*` | logo-done |

Ошибка поля (текст + обводка): [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md)  
(`setUrlScreenFieldInvalid` / `setUrlScreenOtpInvalid` + `setVariant("invalid")`).

Handoff соседних brand-экранов: `handoff: true` (`brandScreenTransition.js`) — правый visual не переигрывается.

`home-screen` — полноэкранный слой (absolute topbar поверх ленты); вкладки feed/mine/rating (топ-50 по репутации, `listRatingTop`); SWR `homeListCache`; fixed-чип «Топы в сети» (`legendary-online-panel`, слева снизу, скрыт если никого нет); FAB feedback (`feedback`, Telegram); toast `notification` (нет уток / слот занят); intro до claim (`homeReviewIntro*`); `reviewedByMe` после submit → фильтр из ленты; mine report gate (`homeMineNotReady*`); фильтр Активные/Завершенные (`tabs-panel`); free-slot «Мои на ревью» до `MAX_MINE_PENDING` (=1) (`homeMineSlotFree*` / toast `homeNotifySlotTaken`); нет монет → toast `homeNotifyNoDucks` + buzz submit + чип баланса; точка на «На ревью» при новом кейсе (`feedSeen` / `homeTabFeedNewAria`); точка на «Мои» и «Завершенные» при непросмотренном 3/3 (`mineReadySeen` / `homeTabMineReadyAria`); tabbar-dock (glass tabs + кнопка submit справа, hide вместе); контраст (`backdropLuminance` → `--on-dark`); entrance cascade на `--open` (`--home-screen-reveal-delay-*`, dock = `motion-reveal-dock` без opacity).
`account-menu` — поповер под аватаром; identity read-only; settings / invite (`homeInviteMessage` на copy/share) / contacts / rules / sign out.
`side-panel` — боковая панель справа (home → «Правила», Figma `517:4740`); слот контента; без `history` / `go()`.  
`settings-screen` — side-route `/settings` (профиль: editable name/Telegram/role/workplace; email/grade/created_at read-only).
`url-screen` — split; чип «На главную» (`.url-screen__back` / `urlScreenBack*`, скрыт на done); при URL справа заглушка «Портфолио»; submit → done на том же экране (`setVariant("done")`).  
`success-screen` — запасной `/done` (deep link); основной submit больше не прыгает сюда (`pendingSuccessPreset` = `generic`).  
`review-screen` — split для квиза (слева panel, справа visual + PDF-лист).  
Шкалы context/visual **1–5** — [`scale-slider`](src/components/scale-slider/README.md). Пул / `tier` / отчёт — [`QUIZ.md`](QUIZ.md).  
`ban-screen` — статичный красный mesh + `banBrandMarkSvg` (не `setVariant`).  
На `/review` в шапке — опциональная надиктовка (`.iframe-shell__rec`), в квизе — микрофон в поле «Главный совет» (`.review-panel__rec`); таймер `REVIEW_SESSION_SECONDS` из [`src/config/review.js`](src/config/review.js).  
Embed: [`content/embed-hosts.md`](content/embed-hosts.md) — спец-embed / blocklist / optimistic + Readymag probe + iframe→external fallback (`embedBlocked*`).  
iframe: пауза при скрытой вкладке; external (портфолио в другой вкладке): wall-clock без паузы + best-effort keep-alive STT; конец → `Timer-end.wav` + стоп записи → quiz. См. [`src/lib/dictation/README.md`](src/lib/dictation/README.md).

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
  tabs-panel/             ← сегмент Активные/Завершенные (Figma tabspanel)
  referral-screen/
  auth-screen/
  auth-code-screen/
  onboarding-screen/
  home-screen/
  legendary-online-panel/ ← fixed-чип «Топы в сети» (слева снизу)
  feedback/            ← fixed FAB feedback (Telegram)
  notification/        ← toast top-right (нет уток / слот занят)
  account-menu/          ← поповер профиля под аватаром
  settings-screen/       ← /settings (профиль)
  url-screen/
  review-screen/
  review-panel/           ← шаги квиза
  scale-slider/           ← шкалы context (1–5) / visual (1–5)
  success-screen/         ← /done (подача портфолио)
  report-screen/          ← /report (листы → side-panel → жалоба)
  ban-screen/             ← /banned (аккаунт заблокирован)
  rating/                 ← неиспользуемый aside (вкладка рейтинга — в home-screen)

src/utils/
  FIELD_ERROR.md          ← fieldError + urlScreenField
  fieldError.js / urlScreenField.js
  brandScreenTransition.js / meshGradientWash.js / motionTokens.js
  backdropLuminance.js    ← яркость фона под tabbar → --on-dark
  homeRoute.js            ← /home query ↔ feed/mine/rating + mine filter
  homeListCache.js        ← SWR feed/mine/rating (memory + sessionStorage)
  feedSeen.js             ← seen id кейсов ленты → точка на «На ревью»
  mineReadySeen.js        ← seen id готовых отчётов → точка на «Мои» / «Завершенные»
  reviewReport.js         ← answers → секции PDF (tier × gradeZone, L1/L2/L3; см. QUIZ.md)

src/config/
  review.js               ← REVIEW_SESSION_SECONDS (таймер /review + intro)
  contacts.js             ← community Telegram URL

src/lib/
  supabaseClient.js
  dictation/              ← DictationEngine (Web Speech MVP; закладка Whisper)

src/assets/brand/
  brandMarks.js           ← SVG + morph (evil без resize / done)

src/api/
  auth.js / profiles.js / onboarding.js / wallet.js
  portfolios.js / leagues.js / referrals.js / reviewComplaints.js
  presence.js / rating.js
  telegramWidget.js / subscribers.js

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
| `createTabsPanel` | сегмент табов (Активные/Завершенные на «Мои») |

| Фабрика | Path | Статус |
|---------|------|--------|
| `createReferralScreen` | `/referral` | UI + validate; field invalid + visual (shell) |
| `createAuthScreen` | `/registration` | UI + Email → authCode / Telegram / Google (shell) |
| `createAuthCodeScreen` | `/registration/code` | UI + OTP; `setUrlScreenOtpInvalid` (shell) |
| `createOnboardingScreen` | `/onboarding` | UI → profiles (shell) |
| `createHomeScreen` | `/home` + query | UI (feed/mine/rating топ-50 по репутации + SWR + intro + mine gate + Активные/Завершенные + free-slot + feedSeen/3/3 + «Топы в сети» + feedback + tabbar-dock + entrance cascade) |
| `createSettingsScreen` | `/settings` | Профиль (имя / Telegram / роль / workplace) |
| `createUrlScreen` | `/portfolio` | UI (back-chip → home; submit + done via `setVariant`; shell) |
| iframe-shell + timer + rec | `/review` | UI (заметки → `answers.dictation`) |
| `createReviewScreen` + `createReviewPanel` (+ `createScaleSlider`) | `/quiz` | UI: visual 1–5, условный pain, `tier`; mic → `advice`. См. [`QUIZ.md`](QUIZ.md) |
| `createSuccessScreen` | `/done` | UI (deep link / generic; submit остаётся на url-screen) |
| `createReportScreen` | `/report` | UI (листы → просмотр → жалоба на лист) |
| `createBanScreen` | `/banned` | UI (блок аккаунта; static evil mark) |

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

Все UI-строки — `content/locales.json` (`referral*`, `homeInvite*` / `homeNoSlots*` / `homeAlreadyReviewed*` / `homeReviewIntro*` / `homeMineNotReady*` / `homeMineFilter*` / `homeEmptyMineActive` / `homeEmptyMineCompleted` / `homeCardReport*` / `homeCardReportPending*` / `homeTabMineReadyAria` / `homeReputation*` / `homeBalance*`, `auth*` / `authCode*` / `authOtp*` / `authIdentityConflict`, `onboarding*`, `home*`, `modalCloseAria`, `url*` / `urlScreenBack*`, `success*`, `reportScreen*` / `reportComplaint*` / `complaintTag*`, `review*` / `reviewRec*` / `reviewAdviceRec*` / `reviewContextShort`·`Value*`·`Hint*` / `reviewVisualShort`·`Value*`·`Hint*` / `report*` / `reportDictationTitle`, `frame*` / `controls*`).
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

`src/api/` — Auth (Email OTP / Telegram / Google + `mapSupabaseAuthErrorCode`), profiles, referrals (validate/redeem), onboarding, wallet sync, shared portfolios queue. См. `src/api/README.md`.

## Дальше

1. Вынести CSS в `brand-screen.css` (классы пока `.url-screen*`).
2. Manual identity linking (`linkIdentity`) + UNIQUE `profiles.email` + Telegram↔email — вне текущего скоупа.
3. Троттлинг злоупотреблений жалобой / тег `misleading` / очередь модерации.
4. Редизайн жалоб / списка листов на `report-screen` (PDF уже есть).
5. Диктовка план B (Whisper Edge) — контракт готов, MVP = Web Speech.

## Связанные документы

- [`STRUCTURE.md`](STRUCTURE.md)
- [`PROJECT.md`](PROJECT.md)
- [`src/app/README.md`](src/app/README.md)
- [`src/components/home-screen/README.md`](src/components/home-screen/README.md) — feed/mine/rating, URL-query, SWR, intro до claim, mine gate, feedSeen/3/3, «Топы в сети», contact FAB, tabbar-dock, entrance cascade / glass / `--on-dark`
- [`src/components/legendary-online-panel/README.md`](src/components/legendary-online-panel/README.md) — fixed-чип «Топы в сети»
- [`src/components/feedback/README.md`](src/components/feedback/README.md) — fixed FAB feedback (Telegram)
- [`src/components/notification/README.md`](src/components/notification/README.md) — toast (нет уток / слот занят)
- [`src/api/rating.js`](src/api/rating.js) — `listRatingTop` (топ-50 по репутации)
- [`src/components/url-screen/README.md`](src/components/url-screen/README.md) — back-chip + done
- [`src/config/review.js`](src/config/review.js) — `REVIEW_SESSION_SECONDS`
- [`src/utils/homeListCache.js`](src/utils/homeListCache.js) — кэш вкладок home
- [`src/utils/homeRoute.js`](src/utils/homeRoute.js) — parse/build/canonical home query
- [`src/utils/feedSeen.js`](src/utils/feedSeen.js) — seen кейсов ленты → точка на «На ревью»
- [`src/utils/mineReadySeen.js`](src/utils/mineReadySeen.js) — seen 3/3 → точка на «Мои» / «Завершенные»
- [`QUIZ.md`](QUIZ.md) — пул вопросов, схема `answers`, L1/L2/L3 PDF
- [`src/components/scale-slider/README.md`](src/components/scale-slider/README.md) — шкалы квиза 1–5 (canvas, ступени, приписки)
- [`src/lib/dictation/README.md`](src/lib/dictation/README.md) — надиктовка: `/review` + поле совета в квизе; iframe pause / external keep-alive; конец → [`Timer-end.wav`](src/assets/audio/Timer-end.wav)
- [`src/components/brand-screen-visual/README.md`](src/components/brand-screen-visual/README.md) — правый visual + variants
- [`src/components/brand-screen-shell/README.md`](src/components/brand-screen-shell/README.md) — split-каркас
- [`src/components/app-modal/README.md`](src/components/app-modal/README.md) — универсальная модалка
- [`src/components/side-panel/README.md`](src/components/side-panel/README.md) — боковая панель
- [`src/components/tabs-panel/README.md`](src/components/tabs-panel/README.md) — сегмент табов
- [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) — ошибки полей
- [`src/assets/README.md`](src/assets/README.md) — марки / morph
- [`src/components/auth-screen/README.md`](src/components/auth-screen/README.md)
- [`src/components/auth-code-screen/README.md`](src/components/auth-code-screen/README.md)
- [`content/onboarding.md`](content/onboarding.md)
- [`.cursor/README.md`](.cursor/README.md)
