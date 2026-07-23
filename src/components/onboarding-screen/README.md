# `onboarding-screen` — онбординг

Path: **`/onboarding`**. После регистрации; визуально — split как у «Ссылка на портфолио».

## Статус

**Stub** (title + hint + nav-заглушка). Монтируется из `main.js`, deep link работает. В happy-path после auth пока не открывается.

## Визуал (цель)

| Сторона | Содержимое |
|---------|------------|
| Правая | mesh + бренд (как url-screen / brand-shell) |
| Левая | вопрос шага + ответы + назад/далее + прогресс |

Сейчас: `brand-screen-shell` + stub-контент (стили shell ещё не вынесены).

## Файл

- `OnboardingScreen.js` — `createOnboardingScreen({ onComplete })` → `{ root, open, close }`.

## Данные

- Шаги: [`content/onboarding.json`](../../../content/onboarding.json)
- Схема: [`content/onboarding.md`](../../../content/onboarding.md)
- Кнопки: `onboarding*` в `locales.json`

## План

1. Один вопрос на шаг; required как в `ReviewPanel`.
2. `onComplete(answers)` → `go("home")`.
3. Опционально `src/api/onboarding.js`.

См. [`SCREENS.md`](../../../SCREENS.md).
