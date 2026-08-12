# Чеклист релиза v1 (юзерам)

Цель: катнуть **desktop-only** продукт на реальных пользователей.  
Мобильного приложения / адаптивного UI **нет** — на &lt;768px только заглушка.

Prod: https://obratka.net/  
Лендос: https://obratka.net/landing/  
(Pages + custom domain; CI `VITE_BASE_PATH=/`. Старый project URL github.io/obratka — не SoT.)  
SoT продукта: [`PROJECT.md`](PROJECT.md) · экраны: [`SCREENS.md`](SCREENS.md)

---

## Скоуп релиза

### Входит

- Invite-only: referral → auth (**Telegram / Google**) → onboarding → home
- Лента ревью (лиги) + claim / heartbeat / release + награда только после submit
- `/review` (iframe/external, 60 s) → `/quiz` → `/quiz/done`
- Подача URL (`/portfolio`, −30) + отчёт автору (`/report`, жалобы, PDF)
- Репутация / рейтинг топ-50 / бан
- Промо `/landing/` + desktop-only заглушка на телефоне
- PostHog воронки

### Не входит (не тестировать как продукт)

- **Email OTP** — UI скрыт (`EMAIL_AUTH_ENABLED = false` в [`src/config/auth.js`](src/config/auth.js)), пока нет стабильного custom SMTP (Unisender и т.п.). Код/экран `/registration/code` остаются, deep link → `/registration`. Вернуть: флаг `true` + SMTP + шаблоны с `{{ .Token }}`
- Мобильный UX ревью / home / quiz
- Waitlist / dual-layout (удалён)
- Manual linking Telegram↔email
- Polish надиктовки (`POLISH_ENABLED = false` — оставить off, пока не решим иначе)
- Теги жалоб вне v1 (`misleading` и т.п.), модерация, троттлинг жалобщиков, лиги в UI

---

## 0. Полиш перед катом (сделать)

Задачи «чуть подкрутить» до релиза — не блокер логики, но лучше закрыть до пуша на юзеров.

### 0.1 Лендинг (`/landing/`)

- [ ] Пройти все блоки: шапка → hero → боль → преимущества → закрытие
- [ ] Копирайт / визуал под финальный месседж invite-only
- [ ] CTA: `?ref=` → `/referral?ref=…`; invite gate → `/registration`; иначе Telegram-сообщество (см. [`landing/README.md`](landing/README.md))
- [x] OG/canonical/robots/sitemap ок на prod (`og-share.png`, absolute URLs на `obratka.net`)
- [ ] Desktop + узкий viewport лендоса читаются (лендос **не** desktop-only гейт SPA)
- [x] Токены `--landing-*`, без сырых цветов (аудит CSS)

### 0.1b Referral placeholder (invite-only)

- [x] Placeholder инпута — пример формата `K7NMPQ3WRA`, **не** seed `YTHWKPDWAK` (seed только ops / инвайты)

SoT: [`landing/README.md`](landing/README.md)

### 0.2 Мобильная заглушка (не мобильный продукт) — сделано

Заглушка = [`desktop-only-screen`](src/components/desktop-only-screen/README.md), не адаптив приложения.

Решение v1: **не** mesh/brand-card — чисто белый экран + одна фраза. Без CTA «продолжить на телефоне».

- [x] Кастом копирайта (RU + EN: `desktopOnlyTitle`, `metaTitleDesktopOnly`; body убран)
- [x] Визуал: белый bg, 14px / regular / gray-900; без mesh и марки
- [x] Без CTA «продолжить на телефоне»
- [x] Smoke: &lt;768 → оверлей; ≥768 → продукт (prod DevTools: 768 продукт / 767 заглушка); mid-review abort — в §2.8

SoT: [`mobile.md`](mobile.md)

### 0.3 «404» / неизвестный URL — сделано

`npm run build` копирует `index.html` → `404.html` — это **SPA-fallback для GitHub Pages** (deep links), не UI «не найдено».

Продуктовый not-found: экран `notFound` на `/404` ([`not-found-screen`](src/components/not-found-screen/)) — тайтл + «На главную» (`session` → `/home`, иначе `/registration`). Мусорный path → `go("notFound", { replace: true })`; корень `/` по-прежнему `resolveEntryScreen`.

- [x] SPA not-found для неизвестных path; Pages `404.html` = entry как есть
- [x] Smoke: deep link известного path на Pages (`/home`, `/referral` incognito, `/landing/`, …) не ломается
- [x] Мусорный path → `/404` (not-found-screen)
- [x] Smoke: `VITE_BASE_PATH=/` на prod (`obratka.net`) не ломает entry / `/404`

### 0.4 Видео: онбординг + лендинг

- [ ] Снять короткий рилс-приветствие и заменить `src/assets/video/welcome-reels.MOV` (онбординг, шаг video `welcome` — см. `OnboardingScreen.js` / `content/onboarding.md`)
- [ ] Записать краткий видеообзор продукта **с озвучкой** для лендинга; **отдельный ассет** под `/landing/` (не подменять `primer.mp4` у home intro — тот же файл сейчас в intro-модалке muted)
- [ ] Подключить новый ролик в `landing/src/main.js` (сейчас `primer.mp4`)
- [ ] Формат/вес ок для web (предпочтительно `.mp4`; `.MOV` только если сознательно оставляем)
- [ ] Smoke: онбординг video-step играет; лендос demo со звуком / CTA не ломается

---

## 1. Инфра и конфиг (до QA)

### 1.1 Env / секреты

| Где | Что проверить |
|-----|----------------|
| `.env.production` / CI | `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `TELEGRAM_BOT_ID`, `VITE_POSTHOG_KEY`, `VITE_POSTHOG_HOST`; CI: `VITE_BASE_PATH=/` (не в `.env.production`) |
| Edge secrets | `TELEGRAM_BOT_TOKEN`; `ZAI_API_KEY` только если снова включим polish |
| Не в git / клиенте | `service_role`, bot token, Google Client Secret, `ZAI_API_KEY` |

- [x] `.env.production` / publishable keys на месте (проверено)
- [x] Edge secrets: `TELEGRAM_BOT_TOKEN` (+ smoke Telegram login на prod); `ZAI_API_KEY` лежит, polish off — не блокер
- [x] Нет `service_role` / bot token / Google Client Secret в клиенте/бандле (аудит allowlist + `.env.production`)
- [x] `git check-ignore -v .env` — локальные секреты не коммитятся (аудит)
- [x] Remote = только `ZaikoPewPew/obratka` (аудит)

### 1.2 Supabase Auth (Dashboard)

**Email OTP — вне скоупа v1-ката** (`EMAIL_AUTH_ENABLED = false`). Пункты про SMTP/токен ниже — только когда вернём почту.

- [ ] ~~Email OTP: шаблоны Magic Link / Confirm signup с `{{ .Token }}`~~ — отложено (SMTP + флаг)
- [x] Site URL + Additional Redirect URLs: localhost + `https://obratka.net/`
- [x] Google OAuth: Client ID/Secret в Dashboard; redirect URI = Supabase callback
- [x] Telegram: bot id в клиенте, token в Edge `telegram-auth`
- [x] Automatic linking Email↔Google включён (из коробки; актуально для Google; Email UI скрыт)

Чеклист: [`auth-screen/README.md`](src/components/auth-screen/README.md)

### 1.3 SQL / Edge на prod

Порядок / re-apply: [`supabase/sql/README.md`](supabase/sql/README.md)

- [x] `profiles` (+ reputation, ban, referral, protect_*)
- [x] `legendary_presence`, `rating_leaderboard`
- [x] `wallet`, `portfolios`, `portfolio_submit`
- [x] `review_claims` (VOLATILE `portfolio_reviewer_slots`, overshoot, award +10)
- [x] `review_complaints` (окно от `completed_at`, −20 / +10 settle)
- [x] `referrals` + seed `YTHWKPDWAK` (prod: `uses` 6 / `max_uses` 600)
- [x] Edge: `telegram-auth`, `portfolio-preview`, `portfolio-embed-probe` задеплоены
- [x] Адвайзоры / матрица RPC: [`supabase/SECURITY.md`](supabase/SECURITY.md) — нет лишнего `EXECUTE` у `anon` (только `validate_referral`; Advisors Errors = 0)

### 1.4 Сборка

- [x] `npm test` — зелёный (аудит: 118/118)
- [x] `npm run build` — `dist/index.html`, `dist/landing/index.html`, `dist/404.html` (аудит после fix)
- [x] Preview / Pages deploy успешен (Actions)

---

## 2. QA продукта (desktop ≥768)

Браузер: Chrome (основной) + один Safari/Firefox smoke.  
Языки: RU по умолчанию + точечно EN (`?lang=en`).

### 2.1 Entry / referral / auth / onboarding

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Чистый device → `/` или `/referral` | Invite gate |
| 2 | Seed `YTHWKPDWAK` | validate ok → auth; `inviteGatePassed` |
| 3 | Битый / exhausted код | ошибка поля + visual `invalid` |
| 4 | ~~Email OTP happy path~~ | **skip v1** — email UI скрыт |
| 5 | ~~Resend OTP~~ | **skip v1** |
| 6 | Telegram Login | сессия → onboarding/home |
| 7 | Google OAuth | return на Pages → onboarding/home |
| 8 | ~~Email ↔ Google same address~~ | **skip v1** (пока нет Email UI); automatic linking остаётся в Dashboard |
| 9 | Onboarding | пишет `profiles`, → `/home` |
| 10 | Logout при пройденном gate | → `/registration`, не снова referral |
| 11 | Deep link `/home` без сессии | → referral/auth |
| 12 | Сессия без онбординга | любой gated path → `/onboarding` |
| 13 | `/registration` | только Telegram + Google (без инпута email и «или») |
| 14 | Deep `/registration/code` | → `/registration` (пока email off) |

### 2.2 Home / экономика / лента

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Вкладки Чужие / Мои / Рейтинг | query `?tab=` / `?filter=`; Back/Forward без remount |
| 2 | SWR | повторный open / F5 без лишнего skeleton при кэше |
| 3 | Сегмент Ждёт / Уже отревьюено | reviewed уходит из open-ленты |
| 4 | Мои: Ещё / Завершенные + free-slot | max 1 pending; dashed слот |
| 5 | «Закинуть» без монет | toast `homeNotifyNoDucks` + buzz submit + чип баланса |
| 6 | «Закинуть» при занятом слоте | toast `homeNotifySlotTaken` (раньше, чем «нет уток») |
| 7 | Баланс 0 → 3 ревью | +10 за каждое; после 30 можно подать |
| 8 | Intro → CTA | claim только после «Сюдаа его!»; «Не сейчас» без claim |
| 9 | Карточка уже 3/3 | `homeNoSlots*` / без claim |
| 10 | Точки feedSeen / mineReadySeen | гаснут при открытии нужного сегмента |
| 11 | Рейтинг | топ-50, иконки +/−/0 репутации |
| 12 | «Топы в сети» | чип есть только если кто-то online |
| 13 | Account-menu | settings / invite (полный `homeInviteMessage`) / contacts / rules / logout |
| 14 | Settings | view-only side-panel; close → home |
| 15 | FAB feedback | открывается Telegram / канал связи |

### 2.3 Review claim / abort / overshoot

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Claim → `/review` | без claim `/review` не открывается |
| 2 | Abort / «На главную» | `release` → **без** +10 |
| 3 | Закрытие вкладки mid-review | keepalive / reconcile; слот «Аноним» не залипает |
| 4 | Heartbeat | claim живёт ~20 min TTL |
| 5 | Late overshoot (уже done, живой claim) | submit ок, **та же** +10 |
| 6 | `already_reviewed` | silent refresh, без модалки |
| 7 | Лига mismatch | senior не видит/не клеймит junior |

### 2.4 `/review` + dictation + embed

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Таймер 60 s | конец → звук + quiz; rec стопается |
| 2 | iframe: скрыть вкладку | таймер на паузе |
| 3 | external: другая вкладка | wall-clock без паузы |
| 4 | Figma / YouTube | спец-embed |
| 5 | Behance / Notion / blocklist | external UI (`embedBlocked*`) |
| 6 | Optimistic → XFO/CSP fail | fallback external + сброс до CTA |
| 7 | Rec (если SpeechRecognition есть) | текст в `answers.dictation`; без поддержки — кнопки скрыты |
| 8 | Mic в совете | пишет в `advice`, не ломает claim |

### 2.5 Quiz → done → награда

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Полный квиз | grade → … → visual 1–5 → (pain если ≤2) → tier → advice |
| 2 | Submit | INSERT review → +10; claim снят |
| 3 | `/quiz/done` | «Следующий кейс» / «На главную»; empty → disabled |
| 4 | Ghost-quiz | без `claimHeld` quiz не открывается |

### 2.6 Подача портфолио + report + жалобы

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | `/portfolio` с балансом ≥30 | spend 30 + insert; done на url-screen; angel mark |
| 2 | Back-chip | → home; на done скрыт |
| 3 | Max 1 pending | второй submit → ошибка/тост слота |
| 4 | Mine &lt; 3/3 | модалка `homeMineNotReady*` |
| 5 | Mine 3/3 → `/report` | все листы (и overshoot) |
| 6 | Side-panel листа | PDF + «Пожаловаться» в окне 6ч от `completed_at` |
| 7 | Вне окна жалобы | кнопку **скрыть** (не «истекло») |
| 8 | Жалоба 1 тег | −20 ревьюеру; 2-я на тот же лист — нельзя |
| 9 | Settle без жалобы | +10 после окна (SQL/ops проверить точечно) |
| 10 | Сводный PDF + action cards | скачивается, не пустой |

### 2.7 Ban / репутация

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | Операторский бан | всегда `/banned`; deep link escape-proof; JWT не рвём |
| 2 | «Выйти» с ban | → registration/referral; повторный логин снова ban |
| 3 | Автобан `reputation <= -100` | `ban_reason = reputation`; UI без reason |
| 4 | Чип репутации | абсолют без `+`; explainer **без** весов тегов |

Ops: [`supabase/BAN.md`](supabase/BAN.md)

### 2.8 Desktop-only gate (smoke, не мобильный продукт)

| # | Сценарий | Ожидание |
|---|----------|----------|
| 1 | DevTools &lt; 768 | белый оверлей + `desktopOnlyTitle`; title desktop-only |
| 2 | ≥ 768 | обычный флоу |
| 3 | 1200 → 375 mid-review | abort, release, без +10 |
| 4 | Deep `/review` на узком | redirect home + оверлей |
| 5 | `?lang=en` на узком | EN на заглушке |

Полный список: [`mobile.md`](mobile.md) § QA.

### 2.9 i18n / a11y smoke

- [ ] Нет хардкод UI-строк на ключевых экранах (всё через `locales.json`)
- [ ] Переключение `?lang=en` на referral / home / desktop-only / ban
- [ ] Aria ключевых кнопок (close modal, rec, tab dots) не пустые

---

## 3. Аналитика и SEO

### PostHog

- [ ] Prod: Network `…/e/` → 200; Live events в кабинете
- [ ] Identify = `profiles.id` после логина; logout → reset
- [ ] Воронка: `referral_validated` → `auth_success` → onboarding → `review_claimed` → `review_submitted`
- [ ] `desktop_only_gate_shown` при узком viewport
- [ ] Нет PII в props (email, Telegram, JWT, тексты advice)

SoT: [`ANALYTICS.md`](ANALYTICS.md)

### SEO / шаринг (лендос)

- [x] `/landing/` indexable; SPA `noindex` (robots Allow `/landing/` + Disallow SPA; meta noindex в `index.html`)
- [x] `robots.txt` / `sitemap.xml` только лендос (smoke prod: sitemap = один `…/landing/`)
- [x] OG preview meta на prod (`og:image` → `og-share.png?v=3`, canonical `/landing/`)

---

## 4. Go / no-go перед пушем юзерам

### Must (блокеры)

- [ ] Auth: **Google + Telegram** на **prod** URL (Email OTP — вне скоупа до SMTP)
- [ ] Полный цикл: invite → onboarding → 1 ревью (+10) → 3 ревью → подача (−30) → 3 листа → report/PDF
- [ ] Claim abort / pagehide **без** ложных монет
- [ ] Ban escape-proof
- [ ] Desktop-only заглушка на телефоне (белый + короткая фраза) ок
- [ ] Лендинг + CTA (Telegram / `?ref=` → referral / gate → registration) ок на prod
- [ ] SQL claims/complaints/referrals/wallet на prod актуальны
- [ ] PostHog пишет события с Pages
- [ ] Нет `service_role` / bot token в бандле (vite allowlist; smoke бандла на prod)

### Nice (можно добить сразу после ката)

- [x] Полиш 404/not-found UX
- [ ] Safari smoke
- [ ] Legendary online с 2+ аккаунтами
- [ ] Overshoot 4-го ревьюера вручную
- [ ] Вернуть Email OTP (SMTP Unisender/аналог + `EMAIL_AUTH_ENABLED = true` + шаблоны `{{ .Token }}`)

### Ops на старте

- [ ] Раздать / опубликовать seed или первые referral-коды (лимит 2 на юзера)
- [ ] Мониторить PostHog Live + Supabase Auth errors / Edge logs первые сутки
- [ ] Шпаргалка бана под рукой: [`supabase/BAN.md`](supabase/BAN.md)

---

## 5. Порядок работ (практика)

1. **Полиш:** лендинг → ~~desktop-only stub~~ → ~~404/not-found~~ (готово) → видео онбординг (`welcome-reels`) + обзор с озвучкой на лендос → smoke deep links / BASE_PATH на Pages
2. **Инфра:** Auth Dashboard (Google + Telegram; Email — later) + SQL/Edge + `.env.production`
3. **Build + deploy** на Pages
4. **QA** по §2 на prod URL (не только localhost); Email-сценарии skip
5. **Аналитика / OG** §3
6. **Go/no-go** §4 → открыть инвайты юзерам

Мобильный продукт не планируем в этом релизе — только заглушка.  
Email OTP — post-launch, когда SMTP стабилен.
