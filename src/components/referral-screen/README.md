# `referral-screen` — реферальный код

Path: **`/referral`**. Визуально 1:1 с `url-screen` (split, mesh, motion).

Invite-only gate: код проверяется через RPC `validate_referral` **до** auth. Seed-код холодного старта: `YTHWKPDWAK` (см. [`supabase/sql/referrals.sql`](../../../supabase/sql/referrals.sql)).

## Отличия от url-screen

| Элемент | Значение |
|---------|----------|
| Заголовок | `referralTitle` — «Введи реферальный код» |
| Placeholder | `referralPlaceholder` — `YTHWKPDWAK` |
| Аватары | 4 тёмных круга (`url-screen__avatar--placeholder`) |
| Текст под полем | `referralColleagues` — «140 твоих коллег уже внутри» |

## Файл

- `ReferralScreen.js` — `createReferralScreen({ onSubmit })` → `{ root, open, close, setError }`.
- `open(prefill?, { handoff? })`, `close({ handoff? })`.
- Стили: `.url-screen*` + `--placeholder` в `iframe-shell.css` / `tokens.css`.

## Visual и ошибки поля

| Слой | Модуль |
|------|--------|
| Правый mesh + марка | [`createBrandScreenVisual`](../brand-screen-visual/README.md) |
| Текст ошибки + красная обводка | `setUrlScreenFieldInvalid` — [`FIELD_ERROR.md`](../../utils/FIELD_ERROR.md) |
| Красный mesh + рожки | `visual.setVariant("invalid")` (без resize SVG) |

Типичный `setError`: FieldInvalid **и** `setVariant("invalid"|"default")` вместе.  
Handoff на auth: `go("auth", { handoff: true })` — visual не переигрывается.

## Поведение

1. Prefill: `?ref=` (через `open(prefill)` из `main.js`); код/URL нормализуется (`normalizeReferralCode`).
2. Submit → `onSubmit(code)` (async). Ошибки (`invalid` / `exhausted` / …) → `setError`.
3. В `main.js`: `validateReferral` → session → `go("auth", { handoff: true })`.
4. После логина: `redeemReferral` (один раз на аккаунт).
5. Deep link `/registration` без кода и без сессии → обратно на `/referral`.

## i18n

`referralTitle`, `referralPlaceholder`, `referralSubmit`, `referralInvalid`, `referralExhausted`, `referralValidateError`, `referralNotConfigured`, `referralColleagues`.

См. [`SCREENS.md`](../../../SCREENS.md), [`src/api/referrals.js`](../../api/referrals.js).
