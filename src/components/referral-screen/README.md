# `referral-screen` — реферальный код

Path: **`/referral`**. Визуально 1:1 с `url-screen` (split, mesh, motion).

## Отличия от url-screen

| Элемент | Значение |
|---------|----------|
| Заголовок | `referralTitle` — «Введите реферальный код» |
| Placeholder | `referralPlaceholder` — `YTHWKPDWAK` |
| Аватары | 4 тёмных круга (`url-screen__avatar--placeholder`) |
| Текст под полем | `referralColleagues` — «140 твоих коллег уже внутри» |

## Файл

- `ReferralScreen.js` — `createReferralScreen({ onSubmit })` → `{ root, open, close }`.
- `open(prefill?, { handoff? })`, `close({ handoff? })`.
- Стили: `.url-screen*` + `--placeholder` в `iframe-shell.css` / `tokens.css`.

## Поведение

1. Prefill: `?ref=` (через `open(prefill)` из `main.js`).
2. Submit непустого кода → `onSubmit(referral)` (без само-close).
3. Дальше: `go("auth", { handoff: true })` в `main.js`.

## i18n

`referralTitle`, `referralPlaceholder`, `referralSubmit`, `referralInvalid`, `referralColleagues`.

См. [`SCREENS.md`](../../../SCREENS.md), [`src/app/README.md`](../../app/README.md).
