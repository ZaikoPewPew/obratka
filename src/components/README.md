# `src/components/` — UI-компоненты

Vanilla DOM-фабрики. Карта экранов и URL: [`SCREENS.md`](../../SCREENS.md).

## Продуктовый флоу

| Модуль | Path | Статус |
|--------|------|--------|
| `brand-screen-shell/` | — | каркас API |
| `referral-screen/` | `/referral` | UI |
| `auth-screen/` | `/registration` | UI |
| `onboarding-screen/` | `/onboarding` | UI (min) |
| `home-screen/` | `/home` | UI (hub + mock) |
| `url-screen/` | `/portfolio` | UI (подача своего) |
| `success-screen/` | `/done` | UI (пресеты) |

## Ревью и квиз

| Модуль | Path | Роль |
|--------|------|------|
| iframe-shell (`index.html` + `main.js`) | `/review` | Просмотр портфолио + таймер |
| `review-screen/` | `/quiz` | Оболочка квиза + PDF reveal |
| `review-panel/` | `/quiz` | Шаги опроса → `onComplete` |

## Прочее (legacy waitlist / общие)

`access-modal`, `apply-card`, `cta-button`, `divider-or`, `email-field`, `locale-toggle`, `logo`, `notification`, `privacy-policy`, `timer`, `waitlist-counter`.
