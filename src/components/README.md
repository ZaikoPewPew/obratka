# `src/components/` — UI-компоненты

Vanilla DOM-фабрики. Карта экранов и URL: [`SCREENS.md`](../../SCREENS.md).

## Продуктовый флоу

| Модуль | Path | Статус |
|--------|------|--------|
| `brand-screen-shell/` | — | каркас API (миграция впереди) |
| `referral-screen/` | `/referral` | UI |
| `auth-screen/` | `/registration` | UI + Email → auth-code / Telegram / Google; identity conflict |
| `auth-code-screen/` | `/registration/code` | UI + OTP verify + resend cooldown |
| `onboarding-screen/` | `/onboarding` | UI → `profiles` |
| `home-screen/` | `/home` | UI (hub + shared feed + wallet) |
| `url-screen/` | `/portfolio` | UI (submit own + done) |
| `success-screen/` | `/done` | UI (пресеты подачи) |
| `ban-screen/` | `/banned` | UI (аккаунт заблокирован) |

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
