# `src/api/` — сетевой слой

Модули для внешних сервисов (Supabase и будущие эндпоинты продукта).

## Состав

### Есть

- `subscribers.js` — сохранение email в таблицу `subscribers` и получение количества подписчиков через RPC/HEAD fallback.

### Local stubs (до Supabase)

| Файл | Роль |
|------|------|
| `portfolios.js` | mock-очередь + `submitPortfolio` stub |
| `wallet.js` | баланс / reward / spend (`session.balance`) |
| `onboarding.js` | `saveOnboardingAnswers` no-op |
| `auth.js` | signUp / signIn / signOut (stub) |
| `referrals.js` | validate / redeem (stub) |

См. [`SCREENS.md`](../../SCREENS.md).
