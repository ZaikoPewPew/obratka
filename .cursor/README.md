# Cursor — проект «Обратка»

Краткая карта для агента. Продукт: [`PROJECT.md`](../PROJECT.md). Экраны: [`SCREENS.md`](../SCREENS.md). Структура: [`STRUCTURE.md`](../STRUCTURE.md).

## Правила (`.cursor/rules/`)

| Файл | О чём |
|------|--------|
| `design-tokens.mdc` | Только `var(--…)` из `tokens.css`, Montserrat, motion (`motion-reveal-dock` / duck / error-buzz / home glass) |
| `i18n.mdc` | UI-строки только из `locales.json` (ru/en) |
| `typography.mdc` | Висячие предлоги 1–3 буквы → NBSP (`fixHangingPrepositions`) |
| `screens.mdc` | Экран = модуль, `go()`, paths, home (feedSeen / 3/3 / rating / legendary), handoff |
| `brand-ui.mdc` | Visual variants, field errors, marks — не копипастить mesh |
| `review-claims.mdc` | Claim / heartbeat / release; награда только после submit |
| `dictation.mdc` | Надиктовка: `/review` → `answers.dictation` + микрофон в поле совета (Web Speech MVP) |
| `leagues.mdc` | Тихий матчинг по `profiles.grade` |
| `referrals.mdc` | Invite-only: validate → redeem, 2 слота, без наград |
| `ban.mdc` | Escape-proof `/banned`, операторский / автобан |
| `reputation.mdc` | Жалобы на листы → репутация → автобан |
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
| Tabs panel | `src/components/tabs-panel/` (`createTabsPanel`, `--tabs-panel-*`) |
| Legendary online | `src/components/legendary-online-panel/` (fixed-чип «Топы в сети») |
| Brand marks / morph | `src/assets/brand/brandMarks.js` |
| Шрифт | `@fontsource/montserrat` → `src/main.js` |

## Экраны и URL

Источник правды: [`SCREENS.md`](../SCREENS.md).

| Path | Экран |
|------|--------|
| `/referral` | Invite-only код (`validate_referral`; seed `YTHWKPDWAK`) |
| `/registration` | Email → `/registration/code` / Telegram / Google |
| `/registration/code` | 6 ячеек OTP |
| `/onboarding` | Онбординг → `profiles` |
| `/home` | Hub: SWR feed/mine/rating + intro до claim + mine report gate + Активные/Завершенные + feedSeen / 3/3 + «Топы в сети» + tabbar-dock (entrance cascade + glass/`--on-dark`) |
| `/settings` | Заглушка настроек (из account-menu) |
| `/portfolio` | Подача URL; back-chip «На главную»; done через `setVariant("done")` |
| `/review` | iframe + таймер 45 s + **rec** (заметки; нужен claim); в квизе — микрофон в поле совета |
| `/quiz` | Квиз |
| `/quiz/done` | Финал квиза |
| `/done` | Запасной success (deep link) |
| `/report` | Листы ревью автора + жалоба → репутация |
| `/banned` | Аккаунт заблокирован (escape-proof; в т.ч. автобан) |

| Что | Где |
|-----|-----|
| Routes / router / flow | `src/app/` |
| Оркестрация | `main.js` → `go()` / `applyRoute()` / `syncRoute()` |
| Screens | `src/components/*-screen/` |
| Квиз | `review-screen/` + `review-panel/` |
| Надиктовка | `src/lib/dictation/` + `.iframe-shell__rec` + `.review-panel__rec` |
| Онбординг-контент | `content/onboarding.json`, `content/onboarding.md` |

Entry CSS: `tokens`, `base`, `entrance`, `app-modal`, `iframe-shell`, `home-screen`, `legendary-online-panel`, `contact-fab`, `tabs-panel`, `account-menu`, `settings-screen`, `success-screen`, `ban-screen`, `report-screen`.

**Home:** вкладки feed/mine/rating (топ-50 `listRatingTop`, кэш `homeListCache`); query через `homeRoute` (`?tab=mine&filter=completed`, Back/Forward без remount); SWR memory + `obratka.homeLists.<userId>`; silent slot patch; feed sort `sortFeedForSlotClosure`; `reviewedByMe` только после submit → disabled + оверлей; intro-модалка до claim (`homeReviewIntro*`); mine report gate (`homeMineNotReady*` пока `reviewsCount < targetReviews`); фильтр Активные/Завершенные (`tabs-panel`; 3/3 → Завершенные); на «Мои на ревью» — free-slot до `MAX_MINE_PENDING` (=1) (`homeMineSlotFree*` / `homePendingLimit*`); точка на «На ревью» при новом кейсе (`feedSeen` / `homeTabFeedNewAria`; гаснет при открытии feed); точка на «Мои» и «Завершенные» при непросмотренном 3/3 (`mineReadySeen` / `homeTabMineReadyAria`; гаснет при открытии «Завершенные»); fixed-чип «Топы в сети» (`legendary-online-panel`); FAB «быстрая связь» (`contact-fab`); own-карточки с `cursor: pointer`; tabbar-dock (glass tabs + «Закинуть своё» справа) + `--on-dark` через `backdropLuminance`; на `open`/reload — entrance cascade `--home-screen-reveal-delay-*` (topbar → body → dock `motion-reveal-dock` **без** opacity на предке glass → fab). Таймер `/review` + intro copy: `src/config/review.js` (`REVIEW_SESSION_SECONDS`). Logout → `clearHomeListCache` + `clearMineReadySeen` + `clearFeedSeen`.
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

1. На `/review` чип rec → Web Speech → текст в памяти.
2. В квизе кнопка микрофона в поле «Главный совет» → текст прямо в `advice`.
3. Submit мержит `answers.dictation` (опционально) → секция листа.
4. Аудио не upload; Whisper — план B за тем же `DictationEngine`.
5. Код: `src/lib/dictation/`; правило `dictation.mdc`.

## Referrals (шпаргалка)

Validate **до** auth → redeem **после** login; 1 код / 2 слота; seed `YTHWKPDWAK`; **без наград**; шаринг с home (аватар → «Пригласить»): copy/share = полный `homeInviteMessage`.  
SQL / API: `supabase/sql/referrals.sql`, `src/api/referrals.js`.

## Ban (шпаргалка)

`profiles.banned_at` → `/banned`. Клиент не пишет ban/tier/reputation. UI: статичный `banBrandMarkSvg`, не `setVariant("invalid")`.  
Автобан: жалобы на листы → `reputation` → порог. Оператор: [`supabase/BAN.md`](../supabase/BAN.md).  
Жалобы: `reputation.mdc`, `supabase/sql/review_complaints.sql`, `src/api/reviewComplaints.js`.

## Auth (шпаргалка)

| Провайдер | Не делать |
|-----------|-----------|
| Email OTP | password-форму; спам resend без cooldown |
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
| `rating_leaderboard.sql` | снапшот топ-50 + `list_rating_top` |
| `wallet.sql` | protect balance + legacy `spend_submit_cost` |
| `referrals.sql` | validate / redeem / seed |
| `portfolios.sql` | очередь + лиги |
| `portfolio_submit.sql` | RPC `submit_portfolio` (atomic spend+insert, max 1 pending) |
| `review_claims.sql` | claim-слоты (после portfolios); award в trigger |
| `review_complaints.sql` | жалобы на листы → reputation → автобан |
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

## Исследования

| Что | Где |
|-----|-----|
| Опрос: дизайнеры и портфолио (2026) | `.cursor/research/designers-portfolio-2026.md` |
| Опросы: дизайн овчарка | `.cursor/research/design-ovcharka-polls.md` |
| Каталог встраивания площадок | `content/embed-hosts.md` |
