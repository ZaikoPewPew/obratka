# Cursor — проект «Обратка»

Краткая карта для агента. Продукт: [`PROJECT.md`](../PROJECT.md). Экраны: [`SCREENS.md`](../SCREENS.md). Структура: [`STRUCTURE.md`](../STRUCTURE.md). Аналитика: [`ANALYTICS.md`](../ANALYTICS.md).

## Правила (`.cursor/rules/`)

| Файл | О чём |
|------|--------|
| `design-tokens.mdc` | Только `var(--…)` из `tokens.css`, Montserrat, motion (`motion-reveal-dock` / duck / error-buzz / home glass) |
| `explainer-media.mdc` | PNG + Lottie `rotating-ray` в модалках: 155% / 268px, цвет `#F3F4F7`, `sync()` |
| `i18n.mdc` | UI-строки только из `locales.json` (ru/en) |
| `typography.mdc` | Висячие предлоги 1–3 буквы → NBSP (`fixHangingPrepositions`) |
| `screens.mdc` | Экран = модуль, `go()`, paths, home (feedSeen / 3/3 / rating / legendary), handoff |
| `brand-ui.mdc` | Visual variants, field errors, marks — не копипастить mesh |
| `review-claims.mdc` | Claim / heartbeat / release; награда только после submit |
| `dictation.mdc` | Надиктовка: Web Speech + post-edit Edge `polish-dictation` (`ZAI_API_KEY`; сейчас **клиент off** — `POLISH_ENABLED`); Whisper = план B |
| `leagues.mdc` | Тихий матчинг по `profiles.grade` |
| `referrals.mdc` | Invite-only: validate → redeem, 2 слота, без наград |
| `ban.mdc` | Escape-proof `/banned`, операторский / автобан |
| `reputation.mdc` | Жалобы: 1 тег / окно 6ч от done; шкала 0…−100; +10 settle; автобан |
| `analytics.mdc` | PostHog: фасад, pageviews, воронки; **новая фича = события** ([`ANALYTICS.md`](../ANALYTICS.md)) |
| `supabase-sql.mdc` | Порядок SQL, RPC, RLS (glob `supabase/**`) |
| `security.mdc` | Секреты, RLS, клиент: anon ок; `service_role` никогда |
| `wallet.mdc` | Баланс: `submit_portfolio` / award; клиент не пишет `balance` |
| `git-remote.mdc` | Remote / Pages только `ZaikoPewPew/obratka` |

## Дизайн-система

| Что | Где |
|-----|-----|
| Токены | `styles/tokens.css` |
| Локали | `content/locales.json`, `src/i18n.js` |
| Motion | `--motion-*`, `entrance.css` (`motion-reveal` / `-scale` / `-topbar` / `-dock` / `-balance-duck-float` / `-control-error-buzz` / idle eyes), `motionTokens.js`, `brandScreenTransition.js` |
| Field errors | `src/utils/FIELD_ERROR.md`, `fieldError.js`, `urlScreenField.js` |
| Brand visual / variants | `src/components/brand-screen-visual/` |
| Brand split-shell | `src/components/brand-screen-shell/` |
| App modal | `src/components/app-modal/` (`createAppModal`, `--app-modal-*`) |
| Explainer PNG + Lottie | [`src/assets/home/modal/README.md`](../src/assets/home/modal/README.md) (`rotating-ray`, `#F3F4F7`, 155%/268px) |
| Tabs panel | `src/components/tabs-panel/` (`createTabsPanel`, `--tabs-panel-*`) |
| Legendary online | `src/components/legendary-online-panel/` (fixed-чип «Топы в сети») |
| Brand marks / morph | `src/assets/brand/brandMarks.js` |
| Шрифт | `@fontsource/montserrat` → `src/fonts.css` (link в `<head>` до tokens) |

## Экраны и URL

Источник правды: [`SCREENS.md`](../SCREENS.md).

| Path | Экран |
|------|--------|
| `/referral` | Invite-only код (`validate_referral`; seed `YTHWKPDWAK`) |
| `/registration` | Telegram / Google (Email OTP скрыт: `EMAIL_AUTH_ENABLED`) |
| `/registration/code` | 6 ячеек OTP; без флага → `/registration` |
| `/onboarding` | Онбординг → `profiles` |
| `/home` | Hub: SWR feed/feedReviewed/mine (+ кэш rating, таб UI off) + intro до claim + mine gate + Ждёт/Уже + Ещё/Завершенные + feedSeen / 3/3 + «Топы в сети» + tabbar-dock (entrance cascade + glass/`--on-dark`) |
| `/settings` | Профиль в side-panel (view-only, без Save) |
| `/portfolio` | Подача URL; back-chip «На главную»; done через `setVariant("done")` |
| `/review` | iframe + таймер 60 s + **rec** (заметки; нужен claim); в квизе — микрофон в поле совета |
| `/quiz` | Квиз: visual 1–5, условный pain, `tier` (не hire); advice + mic — [`QUIZ.md`](../QUIZ.md) |
| `/quiz/done` | Финал квиза (silent `syncRoute`, без `$pageview`) |
| `/done` | Запасной success (deep link) |
| `/report` | Листы + жалоба → reputation; сводный PDF + action cards — [`ACTION_CARDS.md`](../ACTION_CARDS.md) |
| `/banned` | Аккаунт заблокирован (escape-proof; в т.ч. автобан) |
| `/404` | Неизвестный path (`not-found-screen`); CTA → `/home` или `/registration` |
| `/landing/` | Промо MPA (не SPA-route; без session; CTA Telegram-first) — [`landing/README.md`](../landing/README.md) |

**Не path:** `desktop-only-screen` — оверлей &lt;768px ([`mobile.md`](../mobile.md)).

| Что | Где |
|-----|-----|
| Routes / router / flow | `src/app/` |
| Оркестрация | `main.js` → `go()` / `applyRoute()` / `syncRoute()` + desktop-only gate |
| Screens | `src/components/*-screen/` (+ `desktop-only-screen/`) |
| Квиз | `review-screen/` + `review-panel/` + [`scale-slider/`](../src/components/scale-slider/README.md) |
| Надиктовка | `src/lib/dictation/` + `.iframe-shell__rec` + `.review-panel__rec` + Edge `polish-dictation` (клиентский kill-switch) |
| Онбординг-контент | `content/onboarding.json`, `content/onboarding.md` |
| Action cards | `src/data/actionCards.json` + `actionResources.json` · [`ACTION_CARDS.md`](../ACTION_CARDS.md) |

Entry CSS: `tokens`, `base`, `entrance`, `app-modal`, `iframe-shell`, `home-screen`, `legendary-online-panel`, `feedback`, `tabs-panel`, `account-menu`, `settings-screen`, `success-screen`, `ban-screen`, `report-screen` (+ `desktop-only-screen` через import фабрики).

**Home:** вкладки Чужие/Мои (Рейтинг **UI off** — `RATING_TAB_ENABLED = false`; `?tab=rating` → feed; кэш `rating` / `listRatingTop` живы); query через `homeRoute` (`?filter=completed`, `?tab=mine&filter=completed`, Back/Forward без remount); SWR memory + `obratka.homeLists.<userId>` (`feed`/`feedReviewed`/`mine`/`rating`); silent slot patch; feed sort `sortFeedForSlotClosure`; на feed — Ждёт/Уже отревьюено (`tabs-panel`; `listReviewedPortfolios`); `reviewedByMe` → уходит из open-ленты; intro-модалка до claim (`homeReviewIntro*`); mine report gate (`homeMineNotReady*` пока `reviewsCount < targetReviews`); на mine — Ещё/Завершенные (`tabs-panel`; 3/3 → Завершенные); на «Ещё на ревью» — free-slot до `MAX_MINE_PENDING` (=1) (`homeMineSlotFree*` / `homePendingLimit*`); точка на «Чужие посты» при новом кейсе (`feedSeen` / `homeTabFeedNewAria`; гаснет при открытии feed); точка на «Мои» и «Завершенные» при непросмотренном 3/3 (`mineReadySeen` / `homeTabMineReadyAria`; гаснет при открытии «Завершенные»); fixed-чип «Топы в сети» (`legendary-online-panel`); FAB feedback (`feedback`); own-карточки с `cursor: pointer`; tabbar-dock (glass tabs + «Закинуть своё» справа) + `--on-dark` через `backdropLuminance`; на `open`/reload — entrance cascade `--home-screen-reveal-delay-*` (topbar → body → dock `motion-reveal-dock` **без** opacity на предке glass → fab). Таймер `/review` + intro copy: `src/config/review.js` (`REVIEW_SESSION_SECONDS`). Logout → `clearHomeListCache` + `clearMineReadySeen` + `clearFeedSeen`.
**Url-screen:** чип `.url-screen__back` (`urlScreenBack*`) → home; на done скрыт.  
Подробно: [`home-screen/README.md`](../src/components/home-screen/README.md), [`url-screen/README.md`](../src/components/url-screen/README.md).

**Не восстанавливать** waitlist dual-layout (`apply-card`, `desktop.css` / `mobile.css`) без явной задачи.

## Review claims (шпаргалка)

1. Home pick → intro-модалка (`homeReviewIntro*`) → CTA «Сюдаа его!» → `claimPortfolioReview` → `/review` (закрытие / «Не сейчас» — без claim).
2. Mine (`isOwn`): `reviewsCount >= targetReviews` → `onOpenReport` → `/report`; иначе `homeMineNotReady*`.
3. Heartbeat пока на review/quiz (TTL 20 min).
4. Abort / back / pagehide → `release` **без** монет.
5. Награда только после `submitPortfolioReview` → `awardReviewReward`.
6. SQL: `supabase/sql/review_claims.sql`; API: `src/api/portfolios.js`.

## Dictation (шпаргалка)

1. На `/review` чип rec → Web Speech → текст в памяти (`dictationText`).
2. В квизе кнопка микрофона в поле «Главный совет» → текст прямо в `advice`.
3. После stop / перед submit — post-edit пунктуации через Edge `polish-dictation` (`src/api/dictationPolish.js`); default `glm-4.5-flash` + fallback; секрет `ZAI_API_KEY` только в Function secrets. Не STT. Все модели упали → сырой текст, submit ок. **Сейчас `POLISH_ENABLED = false`** (без invoke; вернуть `true` чтобы снова).
4. Submit мержит `answers.dictation` (опционально) → секция листа.
5. Аудио не upload; Whisper — план B за тем же `DictationEngine`.
6. Таймер: iframe — пауза при скрытой вкладке; external — wall-clock + keep-alive STT; конец → `Timer-end.wav` + стоп → quiz.
7. Код: `src/lib/dictation/`; Edge: `supabase/functions/polish-dictation/`; правило `dictation.mdc`.

## Portfolio embed (шпаргалка)

1. SoT список: `content/embed-hosts.md` ← `EXTERNAL_EMBED_HOSTS` / `resolvePortfolioEmbed`.
2. Спец-embed: Figma / YouTube rewrite → iframe.
3. Blocklist суффикс → сразу external UI (`embedBlocked*`), таймер ждёт кнопку.
4. Иначе optimistic iframe; Readymag HTML-probe + blank/error фрейма → escalate external + `armSession`.
5. Не путать с иконками карточек: `platformBrandIcon.js` ≠ стратегия.

## Referrals (шпаргалка)

Validate **до** auth → redeem **после** login; 1 код / 2 слота; seed `YTHWKPDWAK`; **без наград**; шаринг с home (аватар → «Пригласить»): copy + меню Telegram / X / Threads / LinkedIn = полный `homeInviteMessage`. «Сообщество» → `TELEGRAM_COMMUNITY_URL`.  
SQL / API: `supabase/sql/referrals.sql`, `src/api/referrals.js`.

## Ban (шпаргалка)

`profiles.banned_at` → `/banned`. Клиент не пишет ban/tier/reputation. UI: статичный `banBrandMarkSvg`, не `setVariant("invalid")`.  
Автобан: жалоба (−20) → `reputation <= -100` → `banned_at`. Чистые ревью после 6ч от done → +10 (`settle_review_reputation_rewards`). Старт `0`. Оператор: [`supabase/BAN.md`](../supabase/BAN.md).  
Жалобы: `reputation.mdc`, `supabase/sql/review_complaints.sql`, `src/api/reviewComplaints.js`.

## Auth (шпаргалка)

| Провайдер | Не делать |
|-----------|-----------|
| Email OTP | password-форму; спам resend без cooldown. **Сейчас UI off** (`EMAIL_AUTH_ENABLED`) — не включать без SMTP |
| Telegram | дублировать verify вне Edge Function |
| Google | класть Client Secret в клиентский `.env` |

| Защита | Где |
|--------|-----|
| Automatic linking Email↔Google | Supabase Auth; чеклист — `auth-screen/README.md` |
| Resend cooldown 60s | `--auth-code-resend-cooldown` + `auth-code-screen` |
| Identity conflict / rate-limit | `mapSupabaseAuthErrorCode` |
| Manual `linkIdentity` | **не** строить — `PROJECT.md` roadmap #2 |

API: `src/api/auth.js`. Edge: `supabase/functions/telegram-auth/`.

## Security (шпаргалка)

- **Anon ок** в клиенте / `.env.production` / Pages; защита = **RLS**, не секретность ключа.
- **`service_role` / `TELEGRAM_BOT_TOKEN` / Google Client Secret** — никогда в клиент, git или чат.
- Клиент только через `src/lib/supabaseClient.js` (anon).
- **Balance** — primary `submit_portfolio` (atomic spend+insert); legacy `spend_submit_cost`; award в `handle_review_inserted`; не client UPDATE. Подробно — `wallet.mdc` / `security.mdc`.

## Supabase SQL map

| Файл | Роль |
|------|------|
| `profiles.sql` | профиль, ban, reputation, tier, referral-колонки |
| `legendary_presence.sql` | `last_seen_at` + heartbeat/list (legendary online) |
| `rating_leaderboard.sql` | снапшот топ-50 по `reputation` + `list_rating_top` |
| `wallet.sql` | protect balance + legacy `spend_submit_cost` |
| `referrals.sql` | validate / redeem / seed |
| `portfolios.sql` | очередь + лиги |
| `portfolio_submit.sql` | RPC `submit_portfolio` (atomic spend+insert, max 1 pending) |
| `review_claims.sql` | claim-слоты (после portfolios); award в trigger |
| `review_complaints.sql` | reputation (старт 0 / бан −100 / 1 тег / 6ч от done / +10 settle) |
| `ban-templates.sql` | операторский бан |

Порядок и паттерны — `supabase-sql.mdc`.

## Brand UI (шпаргалка)

Эталон split: `url-screen` + `brand-screen-visual`.  
Ошибки: `setUrlScreenFieldInvalid` / `setUrlScreenOtpInvalid` **и** `setVariant("invalid")`.  
Variants: `default` / `invalid` (без resize) / `done`. Handoff: `go(id, { handoff: true })`.  
Оверлей: `createAppModal` — слот контента + CTA; токены `--app-modal-*`.  
Подробно — `brand-ui.mdc`, [`app-modal/README.md`](../src/components/app-modal/README.md).

## Темы и языки

- Тема: `<html data-theme="dark">` (семантика в `tokens.css`)
- Язык: `?lang=en` / кнопка RU↔EN; default `ru`

## Wallet (кратко)

`REVIEW_REWARD = 10` / `SUBMIT_COST = 30` в `src/api/wallet.js` (wired, не stub).  
Старт `balance = 0` → 3 чужих ревью открывают подачу.  
Подача: RPC `submit_portfolio` (atomic spend+insert, max 1 pending).  
Награда: только после `submitPortfolioReview` → `handle_review_inserted` (`REVIEW_REWARD`).  
CTA «Закинуть»: слот занят → `homePendingLimit*`; иначе нет монет → buzz submit + чип баланса (`motion-control-error-buzz`).  
Клиент не пишет `profiles.balance`. Правило: `wallet.mdc`.

## Analytics (шпаргалка)

PostHog через `src/lib/analytics.js` (`track` / `trackPage` / `identifyUser`). Pageviews из `applyRoute`.  
**Новая фича / смена воронки → события** (`analytics.mdc`). SoT имён: [`ANALYTICS.md`](../ANALYTICS.md).  
Env: `VITE_POSTHOG_KEY` + `VITE_POSTHOG_HOST` (`.env.production` для Pages).

## Исследования

| Что | Где |
|-----|-----|
| Опрос: дизайнеры и портфолио (2026) | `.cursor/research/designers-portfolio-2026.md` |
| Опросы: дизайн овчарка | `.cursor/research/design-ovcharka-polls.md` |
| Каталог встраивания площадок | `content/embed-hosts.md` ← `embedHosts.js` / `portfolioEmbed.js`; blocklist → external; optimistic + Readymag probe + blank/error → `embedBlocked*` |
