# `src/api/` — сетевой слой

Модули для внешних сервисов (Supabase и будущие эндпоинты продукта).

## Состав

### Есть

- `subscribers.js` — сохранение email в таблицу `subscribers` и получение количества подписчиков через RPC/HEAD fallback.

### Каркас (stub, throw / пустой список)

| Файл | Роль |
|------|------|
| `auth.js` | signUp / signIn / signOut |
| `referrals.js` | validate / redeem реферального кода |
| `portfolios.js` | очередь портфолио на ревью для `home-screen` |
| `onboarding.js` | сохранение ответов онбординга |

См. [`SCREENS.md`](../../SCREENS.md). Paths: `/registration` (auth), `/referral`, `/home`, `/onboarding`.
