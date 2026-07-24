# `src/components/` — UI-компоненты

Vanilla DOM-фабрики. Карта экранов и URL: [`SCREENS.md`](../../SCREENS.md).

## Общие блоки brand-экранов

| Модуль | Роль |
|--------|------|
| [`brand-screen-visual/`](brand-screen-visual/README.md) | Правый mesh + марка; `setVariant("default"\|"invalid"\|"done")` |
| [`brand-screen-shell/`](brand-screen-shell/README.md) | Split-каркас (form-pane + visual); onboarding уже на нём |
| Field errors | [`../utils/FIELD_ERROR.md`](../utils/FIELD_ERROR.md) — обводка + текст ошибки |

## Продуктовый флоу

| Модуль | Path | Статус |
|--------|------|--------|
| `referral-screen/` | `/referral` | Invite gate + validate RPC |
| `auth-screen/` | `/registration` | Email → auth-code / Telegram / Google |
| `auth-code-screen/` | `/registration/code` | OTP verify + resend cooldown |
| `onboarding-screen/` | `/onboarding` | UI → `profiles` (shell) |
| `home-screen/` | `/home` | хаб + feed + wallet + репутация + шаринг referral |
| `url-screen/` | `/portfolio` | submit own + done (`setVariant("done")`) |
| `review-screen/` | `/quiz` | квиз + PDF-лист |
| `success-screen/` | `/done` | пресеты успеха (deep link) |
| `report-screen/` | `/report` | листы ревью + жалоба |
| `ban-screen/` | `/banned` | блок аккаунта; статичный evil mark |
| `rating/` | — | топ по валюте на home (пока не монтируется) |

## Ревью и квиз

| Модуль | Path | Роль |
|--------|------|------|
| iframe-shell (`index.html` + `main.js`) | `/review` | Просмотр портфолио + таймер |
| `review-screen/` | `/quiz` | Оболочка квиза + PDF reveal |
| `review-panel/` | `/quiz` → `/quiz/done` | Шаги опроса + локальный done |

## Прочее (legacy waitlist / общие)

Не монтируются из текущего `main.js`:  
`access-modal`, `apply-card`, `cta-button`, `divider-or`, `email-field`, `locale-toggle`, `logo`, `notification`, `privacy-policy`, `timer`, `waitlist-counter`.

См. [`PROJECT.md`](../../PROJECT.md) — Entrypoint vs legacy.
