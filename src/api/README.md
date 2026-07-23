# `src/api/` — сетевой слой

Модули для внешних сервисов (Supabase и будущие эндпоинты продукта).

## Состав

### Есть

- `subscribers.js` — сохранение email в таблицу `subscribers` и получение количества подписчиков через RPC/HEAD fallback.
- `auth.js` — Telegram Login → Edge Function → Supabase session.
- `telegramWidget.js` — загрузка Login Widget / `Telegram.Login.auth`.
- `profiles.js` — `fetchMyProfile` / `updateMyProfile` (`public.profiles`).
- `onboarding.js` — `saveOnboardingAnswers` → колонки + `onboarding` jsonb в профиле.

### Local stubs

| Файл | Роль |
|------|------|
| `portfolios.js` | mock-очередь + `submitPortfolio` stub |
| `wallet.js` | баланс / reward / spend (`session.balance`) |
| `referrals.js` | validate / redeem (stub) |

См. [`SCREENS.md`](../../SCREENS.md).
