# `src/components/` — UI-компоненты

Vanilla DOM-фабрики. Карта экранов и URL: [`SCREENS.md`](../../SCREENS.md).

## Продуктовый флоу

| Модуль | Path | Статус |
|--------|------|--------|
| `brand-screen-shell/` | — | каркас API (миграция впереди) |
| `referral-screen/` | `/referral` | UI |
| `auth-screen/` | `/registration` | UI + Telegram / Google |
| `onboarding-screen/` | `/onboarding` | UI → `profiles` |
| `home-screen/` | `/home` | UI (hub + shared feed + wallet) |
| `url-screen/` | `/portfolio` | UI (submit own + done) |
| `success-screen/` | `/done` | UI (пресеты подачи) |

## Ревью и квиз

| Модуль | Path | Роль |
|--------|------|------|
| iframe-shell (`index.html` + `main.js`) | `/review` | Просмотр портфолио + таймер |
| `review-screen/` | `/quiz` | Оболочка квиза + PDF reveal |
| `review-panel/` | `/quiz` → `/quiz/done` | Шаги опроса + локальный done |

## Прочее (legacy waitlist / общие)

`access-modal`, `apply-card`, `cta-button`, `divider-or`, `email-field`, `locale-toggle`, `logo`, `notification`, `privacy-policy`, `timer`, `waitlist-counter`.
