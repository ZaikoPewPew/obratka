# `referral-screen` — реферальная ссылка

Экран ввода реферальной ссылки / кода приглашения.

## Визуал

На базе `brand-screen-shell` (эталон — страница «Ссылка на портфолио»): правый visual как есть, слева поле ввода.

Motion: тот же staggered reveal, что у `url-screen` (после выноса в brand-shell).

## Файл

- `ReferralScreen.js` — `createReferralScreen({ onSubmit })` → `{ root, open, close }`.
- Статус: **каркас** (title + stub hint), не монтируется из `main.js`.

## Поведение (план)

1. Prefill из `?ref=` / `localStorage`, если есть.
2. Нормализация и валидация кода/URL.
3. `onSubmit(referral)` → следующий шаг флоу (`auth-screen`).
4. Опционально: проверка через `src/api/referrals.js`.

## i18n

Ключи в `content/locales.json`: `referralTitle`, `referralPlaceholder`, `referralSubmit`, `referralInvalid`, `referralStubHint`.

## Зависимости

- `brand-screen-shell`
- `src/app/flow.js`
- будущий `src/api/referrals.js`

См. [`SCREENS.md`](../../../SCREENS.md).
