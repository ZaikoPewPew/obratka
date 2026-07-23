# Экраны приложения — архитектура

Карта экранов «Обратки», path-роутинг и ветки с Home.

Статус: **продуктовый флоу wired**. Auth: **Email OTP + Telegram + Google** → `profiles`. Onboarding пишет в Supabase. Home — общая очередь `portfolios`/`reviews` + баланс из `profiles`. Submit URL — done на url-screen; success — пресеты / deep link.

## Продуктовый флоу

```text
referral → auth → authCode → onboarding → home
                              ├─ pick → review → quiz → /quiz/done (review-panel done)
                              └─ submit (url) → done на url-screen → /done (URL sync)
```

| Шаг | Экран | Path | Смысл |
|-----|--------|------|--------|
| 1 | `referral-screen` | `/referral` | Реферальный код |
| 2 | `auth-screen` | `/registration` | Email → OTP screen / Telegram / Google |
| 2b | `auth-code-screen` | `/registration/code` | 6 ячеек кода из письма |
| 3 | `onboarding-screen` | `/onboarding` | Вопросы профиля → `profiles` |
| 4 | `home-screen` | `/home` | Хаб: очередь + баланс + CTA |
| 5a | iframe-shell | `/review` | Ревью выбранного портфолио |
| 5b | `url-screen` | `/portfolio` | Подача своего URL (нужен баланс) |
| 6 | `review-screen` + `review-panel` | `/quiz` → `/quiz/done` | Квиз; финал слева + улет отчёта |
| 7 | `success-screen` | `/done` | Успех подачи: тайтл + «Выйти», зелёный mesh справа |
| — | `ban-screen` | `/banned` | Аккаунт заблокирован; серая «Связаться»; красный mesh; escape-proof |

Корень `/` → `resolveEntryScreen(getSession())`. Query (`?ref=`, `?lang=`) сохраняются.

- **Google return:** hash/query → `completeOAuthFromUrl()` в `main.js` → onboarding / home.
- **Email OTP / Telegram:** остаются на `/registration` до `onSuccess` → `applyProviderUser`.
- **Ban:** `profiles.banned_at` → всегда `/banned` (login, boot, любой deep link).

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

Экраны **referral / auth / onboarding / url** — split-layout (эталон `UrlScreen`):

| Зона | Классы / роль | Поведение |
|------|----------------|-----------|
| Корень | `.url-screen` (цель: `brand-screen`) | Полноэкранный слой, open/close + transition |
| Левая | `__form-pane` | Меняется по экрану |
| Правая | `__visual` | mesh-wash, noise, бренд-марк |

Смена соседних brand-экранов: `handoff: true` (`brandScreenTransition.js`) — правый visual не переигрывается.

`home-screen` — отдельный полноэкранный слой (absolute topbar поверх ленты).  
`url-screen` — split; при URL справа заглушка «Портфолио»; submit → done на том же экране (как quiz).  
`success-screen` — запасной `/done` (deep link); основной submit больше не прыгает сюда.  
`review-screen` — split для квиза (слева panel, справа visual + PDF-лист).

## Дерево файлов

```text
SCREENS.md

src/app/
  routes.js / router.js / flow.js / session.js
  README.md

src/components/
  brand-screen-shell/
  referral-screen/
  auth-screen/
  auth-code-screen/
  onboarding-screen/
  home-screen/
  url-screen/
  review-screen/
  review-panel/           ← только шаги квиза
  success-screen/         ← /done (подача портфолио)
  ban-screen/             ← /banned (аккаунт заблокирован)

src/api/
  auth.js / profiles.js / onboarding.js / wallet.js
  portfolios.js           ← общая очередь Supabase + submit/review
  referrals.js            ← stub
  telegramWidget.js / subscribers.js   ← subscribers = legacy waitlist

styles/
  tokens.css
  iframe-shell.css
  home-screen.css
  success-screen.css
  entrance.css

content/
  locales.json
  onboarding.json / onboarding.md
```

## Контракты

Паттерн: фабрика → `{ root, open, close, … }`. Монтаж и URL — из `main.js` (`go` / `applyRoute`). Компонент **не** знает следующий экран.

| Фабрика | Path | Статус |
|---------|------|--------|
| `createReferralScreen` | `/referral` | UI |
| `createAuthScreen` | `/registration` | UI + Email → authCode / Telegram / Google |
| `createAuthCodeScreen` | `/registration/code` | UI + Email OTP verify |
| `createOnboardingScreen` | `/onboarding` | UI → profiles |
| `createHomeScreen` | `/home` | UI (hub + shared feed) |
| `createUrlScreen` | `/portfolio` | UI (submit own + done) |
| iframe-shell + timer | `/review` | UI |
| `createReviewScreen` + `createReviewPanel` | `/quiz` | UI |
| `createSuccessScreen` | `/done` | UI (portfolio submitted) |

### Handoff

```js
go("auth", { handoff: true }); // referral → auth: visual статичен
```

## Стили / motion

Токены: `styles/tokens.css`. Reveal: `--motion-*`, keyframes в `entrance.css` (в т.ч. `motion-reveal-topbar`), JS `motionTokens.js`.  
Auth: `--auth-screen-*`, `--auth-code-*` (в т.ч. `--auth-code-resend-cooldown`).  
Правило: `.cursor/rules/design-tokens.mdc`.

## i18n

Все UI-строки — `content/locales.json` (`referral*`, `auth*` / `authCode*` / `authOtp*` / `authIdentityConflict`, `onboarding*`, `home*`, `success*`, `review*` / `report*`).  
Правило: `.cursor/rules/i18n.mdc`.

## App-слой

| Файл | Роль |
|------|------|
| `routes.js` | id ↔ path |
| `router.js` | History API + `BASE_URL` |
| `flow.js` | порядок, entry, deep-link access |
| `session.js` | login-сессия + balance в localStorage (`obratka.session`) — **не** путать с `/review` |

## API

`src/api/` — Auth (Email OTP / Telegram / Google + `mapSupabaseAuthErrorCode`), profiles, onboarding, wallet sync, shared portfolios queue. См. `src/api/README.md`.

## Дальше

1. Вынести CSS в `brand-screen.css`.
2. Агрегация оценок нескольких ревьюеров в PDF-отчёте.
3. Referrals validate/redeem.
4. Manual identity linking (`linkIdentity`) + UNIQUE `profiles.email` + Telegram↔email — вне текущего скоупа.

## Связанные документы

- [`STRUCTURE.md`](STRUCTURE.md)
- [`PROJECT.md`](PROJECT.md)
- [`src/app/README.md`](src/app/README.md)
- [`src/components/auth-screen/README.md`](src/components/auth-screen/README.md)
- [`src/components/auth-code-screen/README.md`](src/components/auth-code-screen/README.md)
- [`content/onboarding.md`](content/onboarding.md)
- [`.cursor/README.md`](.cursor/README.md)
