# `src/components/` — UI-компоненты

Vanilla DOM-фабрики. Карта экранов и URL: [`SCREENS.md`](../../SCREENS.md).

## Общие блоки brand-экранов

| Модуль | Роль |
|--------|------|
| [`brand-screen-visual/`](brand-screen-visual/README.md) | Правый mesh + марка; `setVariant("default"\|"invalid"\|"done")` |
| [`brand-screen-shell/`](brand-screen-shell/README.md) | Split-каркас (form-pane + visual); все brand-gate экраны |
| [`app-modal/`](app-modal/README.md) | Универсальная модалка (слот контента + primary/secondary) |
| Field errors | [`../utils/FIELD_ERROR.md`](../utils/FIELD_ERROR.md) — обводка + текст ошибки |

## Продуктовый флоу

| Модуль | Path | Статус |
|--------|------|--------|
| `referral-screen/` | `/referral` | Invite gate + validate RPC (shell) |
| `auth-screen/` | `/registration` | Email → auth-code / Telegram / Google (shell) |
| `auth-code-screen/` | `/registration/code` | OTP verify + resend cooldown (shell) |
| `onboarding-screen/` | `/onboarding` | UI → `profiles` (shell) |
| `home-screen/` | `/home` | хаб + SWR feed/mine + intro modal + mine report gate + glass-tabbar + wallet + репутация + invite |
| `account-menu/` | — | поповер профиля (settings / invite / contacts / sign out) |
| `settings-screen/` | `/settings` | заглушка настроек |
| `url-screen/` | `/portfolio` | submit own + done (`setVariant("done")`; shell) |
| `review-screen/` | `/quiz` | квиз + PDF-лист |
| `success-screen/` | `/done` | пресеты успеха (deep link) |
| `report-screen/` | `/report` | листы ревью + жалоба + PDF |
| `ban-screen/` | `/banned` | блок аккаунта; статичный evil mark |
| `rating/` | — | топ по валюте на home (пока не монтируется) |
| `locale-toggle/` | — | переключатель языка (не в entry; стили не подключены) |

## Ревью и квиз

| Модуль | Path | Роль |
|--------|------|------|
| iframe-shell (`index.html` + `main.js`) | `/review` | Просмотр + таймер 45 s + чип **rec** (надиктовка) |
| `review-screen/` | `/quiz` | Оболочка квиза + PDF reveal |
| `review-panel/` | `/quiz` → `/quiz/done` | Шаги опроса + локальный done |

Движок диктовки: [`../lib/dictation/README.md`](../lib/dictation/README.md).  
См. [`PROJECT.md`](../../PROJECT.md) — Entrypoint.
