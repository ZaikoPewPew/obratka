# `src/components/` — UI-компоненты

Vanilla DOM-фабрики. Карта экранов и URL: [`SCREENS.md`](../../SCREENS.md).

## Общие блоки brand-экранов

| Модуль | Роль |
|--------|------|
| [`brand-screen-visual/`](brand-screen-visual/README.md) | Правый mesh + марка; `setVariant("default"\|"invalid"\|"done")` |
| [`brand-screen-shell/`](brand-screen-shell/README.md) | Split-каркас (form-pane + visual); все brand-gate экраны |
| [`app-modal/`](app-modal/README.md) | Универсальная модалка (слот контента + primary/secondary) |
| [`side-panel/`](side-panel/README.md) | Боковая панель справа (слот контента; home → «Правила») |
| [`tabs-panel/`](tabs-panel/README.md) | Сегмент Активные / Завершенные на «Мои» (`createTabsPanel`) |
| Field errors | [`../utils/FIELD_ERROR.md`](../utils/FIELD_ERROR.md) — обводка + текст ошибки |

## Продуктовый флоу

| Модуль | Path | Статус |
|--------|------|--------|
| `referral-screen/` | `/referral` | Invite gate + validate RPC (shell) |
| `auth-screen/` | `/registration` | Email → auth-code / Telegram / Google (shell) |
| `auth-code-screen/` | `/registration/code` | OTP verify + resend cooldown (shell) |
| `onboarding-screen/` | `/onboarding` | UI → `profiles` (shell) |
| `home-screen/` | `/home` | хаб + SWR feed/mine/rating + intro + mine gate + feedSeen / 3/3 + tabbar-dock (glass / `--on-dark` / entrance) + wallet + репутация + invite + «Топы в сети» + contact FAB |
| `legendary-online-panel/` | — | fixed-чип «Топы в сети» слева снизу на home |
| `contact-fab/` | — | fixed FAB «быстрая связь» (Telegram) справа снизу на home |
| `account-menu/` | — | поповер профиля (settings / invite / contacts / rules / sign out) |
| `settings-screen/` | `/settings` | заглушка настроек |
| `url-screen/` | `/portfolio` | back-chip → home; submit + done (`setVariant("done")`; shell) |
| `review-screen/` | `/quiz` | квиз + PDF-лист |
| `success-screen/` | `/done` | пресеты успеха (deep link) |
| `report-screen/` | `/report` | листы ревью + жалоба + PDF |
| `ban-screen/` | `/banned` | блок аккаунта; статичный evil mark |
| `rating/` | — | неиспользуемый aside; вкладка рейтинга — в `home-screen` |
| `locale-toggle/` | — | legacy waitlist/lang UI; **не в entry**, стили не подключены — [`README`](locale-toggle/README.md) |

## Ревью и квиз

| Модуль | Path | Роль |
|--------|------|------|
| iframe-shell (`index.html` + `main.js`) | `/review` | Просмотр + таймер 45 s (iframe pause / external wall-clock + `Timer-end.wav`) + чип **rec** |
| `review-screen/` | `/quiz` | Оболочка квиза + PDF reveal |
| `review-panel/` | `/quiz` → `/quiz/done` | Шаги опроса + микрофон в advice + локальный done |

Движок диктовки: [`../lib/dictation/README.md`](../lib/dictation/README.md).  
См. [`PROJECT.md`](../../PROJECT.md) — Entrypoint.
