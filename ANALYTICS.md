# Аналитика (PostHog)

Источник правды по продуктовой аналитике Обратки. Правило агента: [`.cursor/rules/analytics.mdc`](.cursor/rules/analytics.mdc). Фасад: [`src/lib/analytics.js`](src/lib/analytics.js). Оркестрация вызовов: [`src/main.js`](src/main.js).

**Да — можно навешивать что угодно куда угодно** через `track(event, props)` / `trackPage` / `identifyUser`. Не плодить прямой `posthog.*` вне фасада. Новая фича / смена воронки → события в этом документе + код.

## Зачем

- Посещаемость экранов (SPA pageviews).
- Воронки: invite → auth → onboarding → review → submit portfolio.
- Клики / CTA / отвалы — именованные события (не «весь кликмап сразу»).
- Identify по `profiles.id` после логина; `reset` на logout.

Бизнес-метрики из Postgres (баланс, число ревью, репутация) — **не** source of truth в PostHog; аналитика = поведение и воронки.

## Стек

| Что | Где |
|-----|-----|
| SDK | `posthog-js` (npm) |
| Фасад | `src/lib/analytics.js` |
| Init | `initAnalytics()` в начале `main.js` (SDK `posthog-js` — dynamic import после paint / idle; вызовы до ready в очереди) |
| Env | `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST` (`.env` / `.env.production`) |
| Host | US `https://us.i.posthog.com` · EU `https://eu.i.posthog.com` |
| Без ключа | no-op (local/CI без env) |

Project token **публичный** (как `SUPABASE_ANON_KEY`) — ок в клиенте и `.env.production` для Pages. Personal API key / write-only secret — **не** в клиент.

Wizard `@posthog/wizard` **не** использовать: проект vanilla Vite, не React/Next; нужен Node ≥22.

## API фасада

```js
import {
  initAnalytics,
  trackPage,
  track,
  identifyUser,
  resetAnalytics,
  isAnalyticsEnabled,
} from "./lib/analytics.js";

initAnalytics();
trackPage("home", { tab: "feed", filter: "active" });
track("review_claimed", { portfolio_id: id });
identifyUser(userId, { grade, tier, onboarding_done });
resetAnalytics(); // logout
```

| Метод | Когда |
|-------|--------|
| `initAnalytics()` | Один раз на boot |
| `trackPage(routeId, props?)` | Успешный settle маршрута в `applyRoute` (шлёт `$pageview`) |
| `track(event, props?)` | Product / CTA / funnel step |
| `identifyUser(id, traits?)` | После логина / boot с живой сессией |
| `resetAnalytics()` | `exitAuthenticatedSession` / logout |

Автоpageview SDK **выключен** (`capture_pageview: false`) — иначе SPA не видна. Pageview только из `applyRoute`.

## Правила именования

1. `snake_case`, английские имена: `review_claimed`, не `ревью_клейм`.
2. Глагол в прошедшем / состоянии: `*_done`, `*_submitted`, `*_failed`, `*_opened`, `*_clicked`.
3. Не дублировать `$pageview`: отдельный event — только если нужен шаг воронки / props, которых нет на pageview.
4. Props — примитивы / короткие enum; **не** слать: email, Telegram, JWT, тексты advice/dictation, полные URL чужих портфолио (достаточно `portfolio_id`), `ban_reason`.
5. Ошибки RPC — в `reason` / `code` строкой (`no_slots`, `already_reviewed`), не сырой `Error.message` с PII.

## Где вешать (архитектура)

| Слой | Можно? | Комментарий |
|------|--------|-------------|
| `main.js` | **Да — предпочтительно** | Claim, submit, auth, abort, route |
| `src/lib/analytics.js` | Только фасад | Не бизнес-события |
| Экран / panel | Редко | Только через колбэк наверх → `track` в `main` (как claim) |
| Прямой `posthog.capture` в UI | **Нет** | Обход фасада ломает no-op / env |

Клики: именованные CTA (`home_submit_clicked`, `review_intro_cta`), не autocapture всего DOM без задачи.

## Pageviews (`$pageview`)

Шлётся после `activeRouteId = id` в `applyRoute`.

| Prop | Смысл |
|------|--------|
| `route_id` | id экрана (`home`, `review`, …) |
| `path` | path из `ROUTE_PATHS` (`/home`, …) |
| `$current_url` | полный URL |
| `tab` / `filter` | только для `home` |

Смена `?tab=` / `?filter=` на home тоже даёт pageview (тот же `route_id`, другие props).

## События сейчас (wired)

| Event | Где | Props | Зачем |
|-------|-----|-------|--------|
| `$pageview` | `applyRoute` | `route_id`, `path`, home `tab`/`filter` | Посещаемость |
| `referral_validated` | referral submit ok | — | Старт воронки invite |
| `auth_success` | `applyProviderUser` | `provider`: `email` \| `telegram` \| `google` | Логин |
| `onboarding_done` | onboarding complete | `grade?` | Конец онбординга |
| `review_claimed` | после успешного claim | `portfolio_id` | Вход в ревью |
| `review_claim_failed` | client/RPC fail | `reason` | Отвал до `/review` |
| `review_submitted` | после INSERT review | `portfolio_id` | Успех ревью (+монеты) |
| `review_aborted` | confirm abort / desktop-only gate | `portfolio_id?`, `route_id?`, `reason?` (`desktop_only_gate`) | Уход без награды |
| `portfolio_submitted` | после `submit_portfolio` | — | Подача своего URL |
| `desktop_only_gate_shown` | первый показ гейта &lt;768px за загрузку | — | Мобильный / узкий вход |

Identify traits: `grade`, `tier`, `onboarding_done` (без email).

## Воронки в PostHog (собрать в UI)

### A. Онбординг (acquisition)

```text
referral_validated → auth_success → $pageview(onboarding) → onboarding_done → $pageview(home)
```

**Планируемые** (навесить при переделке онбординга):

| Event | Когда | Props |
|-------|--------|-------|
| `onboarding_step_viewed` | показ шага | `step_id` (`grade` / `domain` / `goal`) |
| `onboarding_step_completed` | ответ / Далее | `step_id`, опц. `values` (enum, не free text) |
| `onboarding_back` | назад | `from_step_id` |
| `auth_started` | клик Email / Telegram / Google | `provider` |
| `auth_otp_requested` | OTP ушёл | — |
| `auth_failed` | ошибка входа | `provider`, `code` (i18n-код) |

Шаги контента: [`content/onboarding.md`](content/onboarding.md).

### B. Ревью (core loop)

```text
$pageview(home)
  → review_intro_opened          # план
  → review_intro_cta             # план («Сюдаа его!» / dismiss)
  → review_claimed | review_claim_failed
  → $pageview(review)
  → review_timer_completed       # план
  → $pageview(quiz)
  → quiz_step_completed          # план
  → review_submitted | review_aborted
  → $pageview(done) / next_case  # план
```

**Планируемые** (навесить при переделке воронки ревью):

| Event | Когда | Props |
|-------|--------|-------|
| `review_intro_opened` | intro-модалка | `portfolio_id` |
| `review_intro_cta` | CTA / «Не сейчас» | `portfolio_id`, `action`: `start` \| `dismiss` |
| `review_timer_completed` | 45s → quiz | `portfolio_id`, `embed_mode`: `iframe` \| `external` |
| `quiz_step_completed` | шаг квиза | `step` (id вопроса) |
| `review_next_case_clicked` | «Следующий кейс» | `ok` / empty |
| `review_dictation_started` | rec / mic | `source`: `notes` \| `advice` |
| `home_submit_clicked` | «Закинуть своё» | `blocked?`: `no_ducks` \| `slot_taken` |

Claims / abort: [`.cursor/rules/review-claims.mdc`](.cursor/rules/review-claims.mdc).

### C. Подача и отчёт

```text
home_submit_clicked → $pageview(url) → portfolio_submitted → $pageview(success|url done)
home → report_opened → complaint_submitted   # план
```

| Event (план) | Когда | Props |
|--------------|--------|-------|
| `report_opened` | `/report` | `portfolio_id` |
| `complaint_submitted` | жалоба ок | `tag` (`low_effort`…) — без `reporter_id` |
| `invite_shared` | copy/share invite | `method`: `copy` \| `share` |

## Новая фича — чеклист

1. Нужны ли **pageview** (новый route) и/или **события** успеха / отвала / CTA?
2. Имена + props → таблица в **этом** файле (§ «События сейчас» или «Планируемые»).
3. Вызов только через `track` / `trackPage` из `main.js` (или колбэк → `main`).
4. Без PII (см. выше).
5. В PostHog: обновить funnel / insight, если воронка менялась.
6. Проверка: Network `e/` → 200; Live events в кабинете.

Без аналитики мержить продуктовую воронку / новый экран / новый CTA **нельзя** (правило `analytics.mdc`), кроме чисто визуальных правок без поведения.

## Как проверить

**Local:** ключ в `.env` → рестарт `npm run dev` → DevTools Network → `i.posthog.com` / `e/` → **200**.

**PostHog:** Activity / Live events → `$pageview`, `auth_success`, …

**Prod:** после Pages deploy то же на https://zaikopewpew.github.io/obratka/ (ключ в `.env.production`).

Консоль: `posthog.get_distinct_id()` — SDK инициализирован.

## Связанные документы

| Документ | Роль |
|----------|------|
| [`src/lib/README.md`](src/lib/README.md) | Модуль в `lib/` |
| [`STRUCTURE.md`](STRUCTURE.md) | Env |
| [`PROJECT.md`](PROJECT.md) | Продукт / roadmap |
| [`SCREENS.md`](SCREENS.md) | Path ↔ экраны |
| [`content/onboarding.md`](content/onboarding.md) | Шаги онбординга |
| [`.cursor/rules/security.mdc`](.cursor/rules/security.mdc) | Секреты |
| [`.cursor/rules/review-claims.mdc`](.cursor/rules/review-claims.mdc) | Claim / abort |
