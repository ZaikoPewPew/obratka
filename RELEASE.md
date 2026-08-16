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
- Репутация / жалобы / бан (учёт на сервере); вкладка «Рейтинг» на home — **off** (`RATING_TAB_ENABLED`)
- Промо `/landing/` + desktop-only заглушка на телефоне
- PostHog воронки

### Не входит (не тестировать как продукт)

- **Email OTP** — UI скрыт (`EMAIL_AUTH_ENABLED = false` в [`src/config/auth.js`](src/config/auth.js)), пока нет стабильного custom SMTP (Unisender и т.п.). Код/экран `/registration/code` остаются; без гейта deep link → `/referral`, с гейтом и email off → `/registration`. Вернуть: флаг `true` + SMTP + шаблоны с `{{ .Token }}`
- **Вкладка «Рейтинг»** (топ-50 на `/home`) — UI скрыт (`RATING_TAB_ENABLED = false` в [`src/config/home.js`](src/config/home.js)). Учёт reputation / жалобы / settle / бан и чип репутации **работают**. Deep link `?tab=rating` → лента. Вернуть: флаг `true`
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
- [ ] CTA: `?ref=` → `/referral?ref=…`; invite gate → `/registration`; иначе `/referral`. Шапка «Войти» / hero «Попробовать сервис». Closing и футер — Telegram (см. [`landing/README.md`](landing/README.md))
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
- [x] `referrals` + seed `YTHWKPDWAK` (prod: `uses` 7 / `max_uses` 600) + **6 пачек × 100** (ops, коды не в git)
- [x] Edge: `telegram-auth`, `portfolio-preview`, `portfolio-embed-probe` задеплоены
- [x] Адвайзоры / матрица RPC: [`supabase/SECURITY.md`](supabase/SECURITY.md) — нет лишнего `EXECUTE` у `anon` (только `validate_referral`; Advisors Errors = 0)

### 1.4 Сборка

- [x] `npm test` — зелёный (аудит: 141/141, в т.ч. `flow.test.js` invite-gate)
- [x] `npm run build` — `dist/index.html`, `dist/landing/index.html`, `dist/404.html` (аудит после fix)
- [x] Preview / Pages deploy успешен (Actions)

---

## 2. QA продукта (desktop ≥768)

Браузер: Chrome (основной) + один Safari/Firefox smoke.  
Языки: RU по умолчанию + точечно EN (`?lang=en`).

### QA log (prod)

**Отложено на потом (не блокер ядра):** лендинг §0.1, видео §0.4. После этого пуша: smoke гейта §2.1 #14 на prod.

**Аккаунты (раскладка готова):**

| | Вход | Реферал | Заметки |
|---|------|---------|---------|
| **A** | Telegram | seed `YTHWKPDWAK` | инвайты **2/2** («Твои друзья уже в обратке») |
| **B** | Google | код A | middle; портфолио закинуто (ops +утки) |
| **C** | Google | код A | портфолио закинуто (ops +утки) |
| **D** | Google | (цепочка после A) | ок |
| **E** | Google | код D | ок |

Gate: обычный браузер с `inviteGatePassed` → logout на `/registration`; чистый / incognito → `/referral`. Новый код без инкогнито: напрямую `/referral` или `?ref=` (после logout `referralCode` в session сброшен).

**Сессия 1 — done (2026-08-12):**

- [x] Чистый device / incognito → invite gate
- [x] Битый код → ошибка поля + `invalid`
- [x] Валидный код / seed → auth
- [x] Telegram login + onboarding с нуля
- [x] Logout при gate → `/registration`; повторный TG login ок
- [x] Google OAuth ×4 (B–E) + onboarding
- [x] Redeem чужих кодов (A→B/C, D→E); лимит A **2/2**
- [x] Подача портфолио B и C (баланс ops ~90, не «с нуля 0→30»)

**Сессия 2 — done (2026-08-13):** лиги / 3/3 / report / жалобы / бан / desktop-only.

- [x] Лиги: с middle видны junior + middle; с junior — только junior (senior→junior mismatch не смоукали)
- [x] Несколько ревью с разных аккаунтов → квиз → submit → +10
- [x] Junior-кейс до **3/3** (листы: middle, middle, junior) → `/report`
- [x] Отчёт на экране: советы, надиктовка, листы на месте
- [x] Жалобы на **3 листа / 3 тега** (в т.ч. `ai_slop`, `harassment`); кнопка закрывается; повтор → «Жалоба отправлена»
- [x] Репутация ревьюера **−20** за жалобу
- [x] Ops: `reputation = -99` / `-100` **без** `banned_at` → бан не ставится (автобан только из RPC жалобы)
- [x] Ops-бан (`banned_at` + `ban_reason = reputation`) → `/banned`, «Связаться» / «Выйти», reason в UI нет
- [x] Desktop-only: &lt;768 заглушка, ≥768 продукт
- [x] PostHog Web analytics на prod: `$pageview` / пути `/referral` `/home` `/review`… (ключ живой)

**Сессия 3 — done (2026-08-14):** abort без уток + PostHog воронки.

- [x] Ушёл с `/review` до квиза → баланс **не** вырос
- [x] Кастомные события на prod есть (`review_claimed` / `review_timer_completed` / `review_submitted` / `review_aborted` / `onboarding_done` / `desktop_only_gate_shown`…)
- [x] Дашборды: [воронки](https://us.posthog.com/project/539651/dashboard/1994791) (CR / Activation / Drop-off) и [здоровье старта](https://us.posthog.com/project/539651/dashboard/1994800) (DAU / PV / Sessions / Retention / NSM)
- [x] CR3 без `$pageview` `/quiz`: квиз идёт через `syncRoute` (URL без `applyRoute` / pageview); «дошли до квиза» = `review_timer_completed`

**Сессия 4 — done (2026-08-14):** хвост экономики / abort / бан / подача + баг гейта.

- [x] Incognito `/home` без сессии → invite gate
- [x] Exhausted код (A 2/2) → «По этому коду уже пригласили максимум друзей»
- [x] «Закинуть»: слот занят и нет уток — разные тосты, submit закрыт
- [x] Уход с `/review`: уток нет; слот «Аноним» мелькнул и снялся ~1 с
- [x] Таймер на external (другая вкладка) ок; ссылки / embed в целом ок
- [x] Подача своего: spend / done на url-screen / back-chip / max 1 pending / mine &lt; 3/3 — как в спеке
- [x] Бан → «Выйти» → логин тем же аккаунтом → снова `/banned`
- [x] PDF в нативном просмотрщике браузера, контент на месте (файл на диск не качали)
- [x] Desktop-only заглушка при узком viewport — ок
- [x] Баг: `/registration/code` без гейта открывал `/registration` (обход инвайта). Фикс в `resolveAccessibleRoute` + `flow.test.js`; **smoke на prod после деплоя**

**Хвост (не блокер ядра):**

- Фикс гейта `/registration/code` — деплой на Pages; smoke инкогнито без кода → `/referral`
- Таймер до конца 60 s (звук + стоп rec + quiz); пауза таймера на **iframe**
- Сессия без онбординга; deep `/home` с бана + Back; mid-review сужение &lt;768; `?lang=en` на заглушке
- Identify / reset на logout, PII в props — глазами не смоукали (события «вроде норм»)
- RPC-автобан; heartbeat 20 min; late overshoot; `already_reviewed`; senior→junior
- Лендинг / видео — полиш §0
- Публичные seed: 6 пачек × 100 на prod; раздавать порционно (первая ещё не опубликована). Ops SQL: [`supabase/sql/referral-seed-templates.sql`](supabase/sql/referral-seed-templates.sql). Не публиковать `YTHWKPDWAK`

Учитывать лиги: junior ← junior+middle; middle ← middle+senior+; senior ← только senior+.

### 2.1 Entry / referral / auth / onboarding

| # | Сценарий | Ожидание | QA |
|---|----------|----------|-----|
| 1 | Чистый device → `/` или `/referral` | Invite gate | [x] |
| 2 | Seed `YTHWKPDWAK` | validate ok → auth; `inviteGatePassed` | [x] |
| 3 | Битый / exhausted код | ошибка поля + visual `invalid` | [x] битый; exhausted (A 2/2) |
| 4 | ~~Email OTP happy path~~ | **skip v1** — email UI скрыт | skip |
| 5 | ~~Resend OTP~~ | **skip v1** | skip |
| 6 | Telegram Login | сессия → onboarding/home | [x] |
| 7 | Google OAuth | return на Pages → onboarding/home | [x] |
| 8 | ~~Email ↔ Google same address~~ | **skip v1** (пока нет Email UI); automatic linking остаётся в Dashboard | skip |
| 9 | Onboarding | пишет `profiles`, → `/home` | [x] |
| 10 | Logout при пройденном gate | → `/registration`, не снова referral | [x] |
| 11 | Deep link `/home` без сессии | → referral/auth | [x] incognito → invite |
| 12 | Сессия без онбординга | любой gated path → `/onboarding` | |
| 13 | `/registration` | только Telegram + Google (без инпута email и «или») | [x] |
| 14 | Deep `/registration/code` | без гейта → `/referral` (не логин); с гейтом + email off → `/registration` | [~] на prod был обход (без гейта → логин). Фикс в коде; smoke после деплоя |

### 2.2 Home / экономика / лента

| # | Сценарий | Ожидание | QA |
|---|----------|----------|-----|
| 1 | Вкладки Чужие / Мои | query `?tab=` / `?filter=`; Back/Forward без remount. **Рейтинг skip** (`RATING_TAB_ENABLED = false`) | |
| 2 | SWR | повторный open / F5 без лишнего skeleton при кэше | |
| 3 | Сегмент Ждёт / Уже отревьюено | reviewed уходит из open-ленты | |
| 4 | Мои: Ещё / Завершенные + free-slot | max 1 pending; dashed слот | |
| 5 | «Закинуть» без монет | toast `homeNotifyNoDucks` + buzz submit + чип баланса | [x] другой текст, закинуть нельзя |
| 6 | «Закинуть» при занятом слоте | toast `homeNotifySlotTaken` (раньше, чем «нет уток») | [x] пишет что занят |
| 7 | Баланс 0 → 3 ревью | +10 за каждое; после 30 можно подать | |
| 8 | Intro → CTA | claim только после «Сюдаа его!»; «Не сейчас» без claim | |
| 9 | Карточка уже 3/3 | `homeNoSlots*` / без claim | |
| 10 | Точки feedSeen / mineReadySeen | гаснут при открытии нужного сегмента | |
| 11 | ~~Рейтинг~~ | **skip v1** — таб UI off (`RATING_TAB_ENABLED`); чип репутации живой | skip |
| 12 | «Топы в сети» | чип есть только если кто-то online | |
| 13 | Account-menu | settings / invite (полный `homeInviteMessage`) / contacts / rules / logout | |
| 14 | Settings | view-only side-panel; close → home | |
| 15 | FAB feedback | открывается Telegram / канал связи | |

### 2.3 Review claim / abort / overshoot

| # | Сценарий | Ожидание | QA |
|---|----------|----------|-----|
| 1 | Claim → `/review` | без claim `/review` не открывается | [x] claim→review с нескольких аккаунтов |
| 2 | Abort / «На главную» | `release` → **без** +10 | [x] ушёл до квиза, утки не капнули |
| 3 | Закрытие вкладки mid-review | keepalive / reconcile; слот «Аноним» не залипает | [x] слот «Аноним» ~1 с и снялся |
| 4 | Heartbeat | claim живёт ~20 min TTL | |
| 5 | Late overshoot (уже done, живой claim) | submit ок, **та же** +10 | |
| 6 | `already_reviewed` | silent refresh, без модалки | |
| 7 | Лига mismatch | senior не видит/не клеймит junior | [~] middle видит junior+middle; junior — только junior; senior mismatch — нет |

### 2.4 `/review` + dictation + embed

| # | Сценарий | Ожидание | QA |
|---|----------|----------|-----|
| 1 | Таймер 60 s | конец → звук + quiz; rec стопается | |
| 2 | iframe: скрыть вкладку | таймер на паузе | |
| 3 | external: другая вкладка | wall-clock без паузы | [x] таймер на внешних сайтах ок |
| 4 | Figma / YouTube | спец-embed | [x] ссылки / embed в целом ок |
| 5 | Behance / Notion / blocklist | external UI (`embedBlocked*`) | [x] ссылки / embed в целом ок |
| 6 | Optimistic → XFO/CSP fail | fallback external + сброс до CTA | |
| 7 | Rec (если SpeechRecognition есть) | текст в `answers.dictation`; без поддержки — кнопки скрыты | [x] надиктовка доехала в отчёт |
| 8 | Mic в совете | пишет в `advice`, не ломает claim | [x] советы в отчёте |

### 2.5 Quiz → done → награда

| # | Сценарий | Ожидание | QA |
|---|----------|----------|-----|
| 1 | Полный квиз | grade → … → visual 1–5 → (pain если ≤2) → tier → advice | [x] несколько листов с разных аккаунтов |
| 2 | Submit | INSERT review → +10; claim снят | [x] |
| 3 | `/quiz/done` | «Следующий кейс» / «На главную»; empty → disabled | |
| 4 | Ghost-quiz | без `claimHeld` quiz не открывается | |

### 2.6 Подача портфолио + report + жалобы

| # | Сценарий | Ожидание | QA |
|---|----------|----------|-----|
| 1 | `/portfolio` с балансом ≥30 | spend 30 + insert; done на url-screen; angel mark | [x] подача как в спеке (Сессия 4) |
| 2 | Back-chip | → home; на done скрыт | [x] |
| 3 | Max 1 pending | второй submit → ошибка/тост слота | [x] тост слота занят |
| 4 | Mine &lt; 3/3 | модалка `homeMineNotReady*` | [x] |
| 5 | Mine 3/3 → `/report` | все листы (и overshoot) | [x] junior 3/3, три листа в отчёте |
| 6 | Side-panel листа | PDF + «Пожаловаться» в окне 6ч от `completed_at` | [x] жалоба с панели; PDF в браузерном просмотрщике |
| 7 | Вне окна жалобы | кнопку **скрыть** (не «истекло») | |
| 8 | Жалоба 1 тег | −20 ревьюеру; 2-я на тот же лист — нельзя | [x] 3 листа × 3 тега; повтор закрыт («Жалоба отправлена») |
| 9 | Settle без жалобы | +10 после окна (SQL/ops проверить точечно) | |
| 10 | Сводный PDF + action cards | скачивается, не пустой | [x] нативный PDF-viewer браузера, контент на месте (файл на диск не качали) |

### 2.7 Ban / репутация

| # | Сценарий | Ожидание | QA |
|---|----------|----------|-----|
| 1 | Операторский бан | всегда `/banned`; deep link escape-proof; JWT не рвём | [~] `/banned` ок; deep `/home` / Back — не смоукали |
| 2 | «Выйти» с ban | → registration/referral; повторный логин снова ban | [x] перелогин → снова бан |
| 3 | Автобан `reputation <= -100` | `ban_reason = reputation`; UI без reason | [~] голый `reputation = -100` бан **не** ставит; RPC-автобан не гоняли (нужна новая жалоба). Экран бана смоукали ops-полем `banned_at` |
| 4 | Чип репутации | абсолют без `+`; explainer **без** весов тегов | [x] −20 после жалобы |

Ops: [`supabase/BAN.md`](supabase/BAN.md)

### 2.8 Desktop-only gate (smoke, не мобильный продукт)

| # | Сценарий | Ожидание | QA |
|---|----------|----------|-----|
| 1 | DevTools &lt; 768 | белый оверлей + `desktopOnlyTitle`; title desktop-only | [x] |
| 2 | ≥ 768 | обычный флоу | [x] |
| 3 | 1200 → 375 mid-review | abort, release, без +10 | |
| 4 | Deep `/review` на узком | redirect home + оверлей | |
| 5 | `?lang=en` на узком | EN на заглушке | |

Полный список: [`mobile.md`](mobile.md) § QA.

### 2.9 i18n / a11y smoke

- [ ] Нет хардкод UI-строк на ключевых экранах (всё через `locales.json`)
- [ ] Переключение `?lang=en` на referral / home / desktop-only / ban
- [ ] Aria ключевых кнопок (close modal, rec, tab dots) не пустые

---

## 3. Аналитика и SEO

### PostHog

- [x] Prod: `$pageview` + кастомные события воронки на Pages (HogQL 30д: `review_submitted` 24 / 9 людей, `review_claimed` 33, `review_aborted` 3)
- [x] Дашборды в кабинете: [воронки CR](https://us.posthog.com/project/539651/dashboard/1994791) · [здоровье старта](https://us.posthog.com/project/539651/dashboard/1994800)
- [ ] Identify = `profiles.id` после логина; logout → reset
- [x] Воронка ревью: intro → claim → `/review` → `review_timer_completed` → `review_submitted` (не `$pageview` `/quiz` — `syncRoute` без pageview)
- [x] `desktop_only_gate_shown` есть в событиях (узкий viewport)
- [ ] Нет PII в props (email, Telegram, JWT, тексты advice)

Виджет Web analytics «Waiting for events…» ждёт **новое** событие, пока панель открыта — не значит, что трека нет. Installation Health (!) при живых событиях не блокер. `Filter test accounts` off (ок для QA; перед катом юзерам — включить). Старые пути `/obratka/…` — легаси base path, не SoT. `/quiz` и `/quiz/done` в pageviews **нет** (намеренно, silent `syncRoute`).

SoT: [`ANALYTICS.md`](ANALYTICS.md)

### SEO / шаринг (лендос)

- [x] `/landing/` indexable; SPA `noindex` (robots Allow `/landing/` + Disallow SPA; meta noindex в `index.html`)
- [x] `robots.txt` / `sitemap.xml` только лендос (smoke prod: sitemap = один `…/landing/`)
- [x] OG preview meta на prod (`og:image` → `og-share.png?v=3`, canonical `/landing/`)

---

## 4. Go / no-go перед пушем юзерам

### Must (блокеры)

- [x] Auth: **Google + Telegram** на **prod** URL (Email OTP — вне скоупа до SMTP) — Сессия 1
- [x] Полный цикл: invite → onboarding → ревью (+10) → 3/3 → `/report` + жалобы — Сессия 2 (junior-кейс; подача B+C была в Сессии 1; PDF в браузерном viewer — Сессия 4)
- [x] Claim abort без ложных монет — Сессия 3–4 (уход до квиза; слот «Аноним» снялся)
- [~] Ban: экран `/banned` + Связаться/Выйти ок; logout→login снова бан (Сессия 4); deep `/home` / Back — не смоукали; RPC-автобан — не гоняли
- [x] Desktop-only заглушка на телефоне (белый + короткая фраза) ок
- [ ] Лендинг + CTA (Telegram / `?ref=` → referral / gate → registration) ок на prod — **отложено** (полиш §0.1)
- [x] SQL claims/complaints/referrals/wallet на prod актуальны
- [x] PostHog пишет с Pages; воронки CR / здоровье старта собраны — Сессия 3 (identify/PII глазами не смоукали; «вроде норм»)
- [x] Нет `service_role` / bot token в бандле (vite allowlist; smoke бандла на prod)

### Nice (можно добить сразу после ката)

- [x] Полиш 404/not-found UX
- [ ] Safari smoke
- [ ] Legendary online с 2+ аккаунтами
- [ ] Overshoot 4-го ревьюера вручную
- [ ] Вернуть Email OTP (SMTP Unisender/аналог + `EMAIL_AUTH_ENABLED = true` + шаблоны `{{ .Token }}`)
- [ ] Вернуть вкладку «Рейтинг» (`RATING_TAB_ENABLED = true` в [`src/config/home.js`](src/config/home.js))

### Ops на старте

- [~] Раздать публичные инвайты — 6 seed-пачек × 100 на prod (2026-08-14); коды только ops, не в git / не `YTHWKPDWAK`. Первая пачка ещё не опубликована. Убить пачку: `max_uses = uses` ([`referral-seed-templates.sql`](supabase/sql/referral-seed-templates.sql))
- [ ] Мониторить PostHog Live + Supabase Auth errors / Edge logs первые сутки
- [ ] Шпаргалка бана под рукой: [`supabase/BAN.md`](supabase/BAN.md)

---

## 5. Порядок работ (практика)

1. **Полиш:** лендинг → ~~desktop-only stub~~ → ~~404/not-found~~ (готово) → видео онбординг (`welcome-reels`) + обзор с озвучкой на лендос → smoke deep links / BASE_PATH на Pages — **лендос/видео отложены**
2. **Инфра:** Auth Dashboard (Google + Telegram; Email — later) + SQL/Edge + `.env.production` — done
3. **Build + deploy** на Pages — фикс гейта `/registration/code` в этом пуше
4. **QA** по §2 на prod URL — **Сессия 1–4 done** (см. QA log)
5. **Аналитика / OG** §3 — события + дашборды [x]; identify/PII ещё; OG лендоса [x]
6. **Go/no-go** §4 → открыть инвайты юзерам (лендинг отложен; seed-пачки готовы, раздавать порционно; после деплоя — smoke `/registration/code`)

Мобильный продукт не планируем в этом релизе — только заглушка.  
Email OTP — post-launch, когда SMTP стабилен.
