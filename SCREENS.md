# Экраны приложения — архитектура

Карта экранов «Обратки», path-роутинг и ветки с Home.

Статус: **продуктовый флоу wired**. Auth: **Email OTP + Telegram + Google** → `profiles`. Onboarding пишет в Supabase. Home — очередь `portfolios`/`reviews` по лиге грейда + баланс из `profiles`. Submit URL — done на url-screen; success — пресеты / deep link.

## Продуктовый флоу

```text
referral → auth → authCode → onboarding → home
                              ├─ pick → claim → review → quiz → /quiz/done (review-panel done)
                              ├─ mine card → report (листы + жалоба)
                              └─ submit (url) → done на url-screen → /done (URL sync)
```

| Шаг | Экран | Path | Смысл |
|-----|--------|------|--------|
| 1 | `referral-screen` | `/referral` | Реферальный код (validate RPC; seed `YTHWKPDWAK`); стек аватаров — random из `founder-avatars.json` |
| 2 | `auth-screen` | `/registration` | Email → OTP screen / Telegram / Google |
| 2b | `auth-code-screen` | `/registration/code` | 6 ячеек кода из письма |
| 3 | `onboarding-screen` | `/onboarding` | Вопросы профиля → `profiles` |
| 4 | `home-screen` | `/home` | Хаб: очередь + баланс + CTA |
| 5a | iframe-shell | `/review` | Ревью выбранного портфолио (после claim слота) |
| 5b | `url-screen` | `/portfolio` | Подача своего URL (нужен баланс) |
| 6 | `review-screen` + `review-panel` | `/quiz` → `/quiz/done` | Квиз; финал слева + улет отчёта |
| 7 | `success-screen` | `/done` | Успех подачи: тайтл + «Выйти», зелёный mesh справа |
| 8 | `report-screen` | `/report` | Отчёт автору: листы + жалоба + PDF (мокап листа → done после скачивания) |
| — | `ban-screen` | `/banned` | Аккаунт заблокирован; «Выйти» + «Связаться» (242px); красный mesh; deep link escape-proof |

Корень `/` → `resolveEntryScreen(getSession())`. Query (`?ref=`, `?lang=`) сохраняются.

- **Google return:** hash/query → `completeOAuthFromUrl()` в `main.js` → onboarding / home.
- **Email OTP / Telegram:** остаются на `/registration` до `onSuccess` → `applyProviderUser`.
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

`home-screen` — отдельный полноэкранный слой (absolute topbar поверх ленты).  
`url-screen` — split; при URL справа заглушка «Портфолио»; submit → done на том же экране (`setVariant("done")`).  
`success-screen` — запасной `/done` (deep link); основной submit больше не прыгает сюда.  
`review-screen` — split для квиза (слева panel, справа visual + PDF-лист).  
`ban-screen` — статичный красный mesh + `banBrandMarkSvg` (не `setVariant`).

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
  referral-screen/
  auth-screen/
  auth-code-screen/
  onboarding-screen/
  home-screen/
  url-screen/
  review-screen/
  review-panel/           ← только шаги квиза
  success-screen/         ← /done (подача портфолио)
  report-screen/          ← /report (листы ревью + жалоба)
  ban-screen/             ← /banned (аккаунт заблокирован)

src/utils/
  FIELD_ERROR.md          ← fieldError + urlScreenField
  fieldError.js / urlScreenField.js
  brandScreenTransition.js / meshGradientWash.js / motionTokens.js

src/assets/brand/
  brandMarks.js           ← SVG + morph (evil без resize / done)

src/api/
  auth.js / profiles.js / onboarding.js / wallet.js
  portfolios.js / leagues.js / referrals.js
  telegramWidget.js / subscribers.js

styles/
  tokens.css
  entrance.css
  app-modal.css
  iframe-shell.css
  home-screen.css
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

| Фабрика | Path | Статус |
|---------|------|--------|
| `createReferralScreen` | `/referral` | UI + validate; field invalid + visual (shell) |
| `createAuthScreen` | `/registration` | UI + Email → authCode / Telegram / Google (shell) |
| `createAuthCodeScreen` | `/registration/code` | UI + OTP; `setUrlScreenOtpInvalid` (shell) |
| `createOnboardingScreen` | `/onboarding` | UI → profiles (shell) |
| `createHomeScreen` | `/home` | UI (hub + feed + invite modal) |
| `createUrlScreen` | `/portfolio` | UI (submit + done via `setVariant`; shell) |
| iframe-shell + timer | `/review` | UI |
| `createReviewScreen` + `createReviewPanel` | `/quiz` | UI |
| `createSuccessScreen` | `/done` | UI (portfolio submitted) |
| `createReportScreen` | `/report` | UI (листы + жалоба на лист) |
| `createBanScreen` | `/banned` | UI (блок аккаунта; static evil mark) |

### Handoff

```js
go("auth", { handoff: true }); // referral → auth: visual статичен
```

## Стили / motion

Токены: `styles/tokens.css`. Reveal: `--motion-*`, keyframes в `entrance.css` (в т.ч. `motion-reveal-topbar`), JS `motionTokens.js`.  
Field error: `--motion-field-error-*`, `--motion-field-error-visual-*`.  
Auth: `--auth-screen-*`, `--auth-code-*` (в т.ч. `--auth-code-resend-cooldown`).  
App modal: `--app-modal-*` + `styles/app-modal.css` ([`app-modal/README.md`](src/components/app-modal/README.md)).  
Правило: `.cursor/rules/design-tokens.mdc`.

## i18n

Все UI-строки — `content/locales.json` (`referral*`, `homeInvite*`, `auth*` / `authCode*` / `authOtp*` / `authIdentityConflict`, `onboarding*`, `home*` / `homeReputation*`, `modalCloseAria`, `success*`, `reportScreen*` / `reportComplaint*` / `complaintTag*`, `review*` / `report*`).
Правило: `.cursor/rules/i18n.mdc`.

## App-слой

| Файл | Роль |
|------|------|
| `routes.js` | id ↔ path |
| `router.js` | History API + `BASE_URL` |
| `flow.js` | порядок, entry, deep-link access (auth без кода → referral) |
| `session.js` | login-сессия + balance + referral fields в localStorage (`obratka.session`) — **не** путать с `/review` |

## API

`src/api/` — Auth (Email OTP / Telegram / Google + `mapSupabaseAuthErrorCode`), profiles, referrals (validate/redeem), onboarding, wallet sync, shared portfolios queue. См. `src/api/README.md`.

## Дальше

1. Вынести CSS в `brand-screen.css` (классы пока `.url-screen*`).
2. Manual identity linking (`linkIdentity`) + UNIQUE `profiles.email` + Telegram↔email — вне текущего скоупа.
3. Редизайн жалоб / списка листов на `report-screen` (PDF уже есть).

## Связанные документы

- [`STRUCTURE.md`](STRUCTURE.md)
- [`PROJECT.md`](PROJECT.md)
- [`src/app/README.md`](src/app/README.md)
- [`src/components/brand-screen-visual/README.md`](src/components/brand-screen-visual/README.md) — правый visual + variants
- [`src/components/brand-screen-shell/README.md`](src/components/brand-screen-shell/README.md) — split-каркас
- [`src/components/app-modal/README.md`](src/components/app-modal/README.md) — универсальная модалка
- [`src/utils/FIELD_ERROR.md`](src/utils/FIELD_ERROR.md) — ошибки полей
- [`src/assets/README.md`](src/assets/README.md) — марки / morph
- [`src/components/auth-screen/README.md`](src/components/auth-screen/README.md)
- [`src/components/auth-code-screen/README.md`](src/components/auth-code-screen/README.md)
- [`content/onboarding.md`](content/onboarding.md)
- [`.cursor/README.md`](.cursor/README.md)
