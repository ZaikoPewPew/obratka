# `src/components/` — UI-компоненты

Vanilla DOM-фабрики. Карта экранов и URL: [`SCREENS.md`](../../SCREENS.md).

## Общие блоки brand-экранов

| Модуль | Роль |
|--------|------|
| [`brand-screen-visual/`](brand-screen-visual/README.md) | Правый mesh + марка; `setVariant("default"\|"invalid"\|"done")` |
| [`brand-screen-shell/`](brand-screen-shell/README.md) | Split-каркас (form-pane + visual); все brand-gate экраны |
| [`app-modal/`](app-modal/README.md) | Универсальная модалка (слот контента + primary/secondary) |
| [`side-panel/`](side-panel/README.md) | Боковая панель справа (слот контента; home → «Правила») |
| [`notification/`](notification/README.md) | Toast top-right (нет уток / слот занят на home) |
| [`tabs-panel/`](tabs-panel/README.md) | Сегмент feed/mine на home (`createTabsPanel`) |
| Field errors | [`../utils/FIELD_ERROR.md`](../utils/FIELD_ERROR.md) — обводка + текст ошибки |

## Продуктовый флоу

| Модуль | Path | Статус |
|--------|------|--------|
| `referral-screen/` | `/referral` | Invite gate + validate RPC (shell) |
| `auth-screen/` | `/registration` | Email → auth-code / Telegram / Google (shell) |
| `auth-code-screen/` | `/registration/code` | OTP verify + resend cooldown (shell) |
| `onboarding-screen/` | `/onboarding` | UI → `profiles` (shell) |
| `home-screen/` | `/home` | хаб + SWR feed/feedReviewed/mine/rating + Ждёт/Уже + Ещё/Завершенные + intro + mine gate + feedSeen / 3/3 + tabbar-dock (glass / `--on-dark` / entrance) + wallet + репутация + invite + «Топы в сети» + feedback FAB |
| `legendary-online-panel/` | — | fixed-чип «Топы в сети» слева снизу на home |
| `feedback/` | — | fixed FAB feedback (Telegram) справа снизу на home |
| `account-menu/` | — | поповер профиля (settings / invite / contacts / rules / sign out) |
| `settings-screen/` | `/settings` | профиль в side-panel поверх home |
| `url-screen/` | `/portfolio` | back-chip → home; submit + done (`setVariant("done")`; shell) |
| `review-screen/` | `/quiz` | квиз + PDF-лист |
| `success-screen/` | `/done` | пресеты успеха (deep link) |
| `report-screen/` | `/report` | листы ревью + жалоба + сводный PDF (action cards) |
| `ban-screen/` | `/banned` | блок аккаунта; статичный evil mark |
| `desktop-only-screen/` | *(оверлей)* | viewport &lt; 768px — «только с компьютера»; не path — [`README`](desktop-only-screen/README.md), [`mobile.md`](../../mobile.md) |
| `rating/` | — | неиспользуемый aside; вкладка рейтинга — в `home-screen` |
| `locale-toggle/` | — | legacy waitlist/lang UI; **не в entry**, стили не подключены — [`README`](locale-toggle/README.md) |

## Ревью и квиз

| Модуль | Path | Роль |
|--------|------|------|
| iframe-shell (`index.html` + `main.js`) | `/review` | Просмотр + таймер 60 s (iframe pause / external wall-clock + `Timer-end.wav`) + чип **rec** |
| `review-screen/` | `/quiz` | Оболочка квиза + PDF reveal |
| `review-panel/` | `/quiz` → `/quiz/done` | Шаги опроса + шкалы 1–5 + условный pain + `tier` + mic в advice + локальный done. SoT: [`QUIZ.md`](../../QUIZ.md) |
| `scale-slider/` | — | Шкалы context/visual: canvas-сетка, nearest + hover-превью ступеней, min/max — [`README`](scale-slider/README.md) |
| `video-player-card/` | — | Кастомный плеер (play/mute/scrub/speed); шаг video онбординга |

Движок диктовки: [`../lib/dictation/README.md`](../lib/dictation/README.md).  
Post-edit: [`../api/dictationPolish.js`](../api/dictationPolish.js) → [`polish-dictation`](../../supabase/functions/polish-dictation/README.md) (**`POLISH_ENABLED = false`**).  
См. [`PROJECT.md`](../../PROJECT.md) — Entrypoint.
