# `onboarding-screen` — онбординг

Path: **`/onboarding`**. После регистрации; split url-screen + слева **те же паттерны, что у `review-panel`**.

## UI

Классы квиза 1:1: `review-panel__top` / `__back` / `__progress` / `__choice` / `__nav` / `__submit`, auto-advance по radio, motion шагов.

Тексты — `onboarding*` в `locales.json` (вместо `review*`). Шаги — [`content/onboarding.json`](../../../content/onboarding.json).

## API

`createOnboardingScreen({ onComplete })` → `{ root, open, close }`.

Финиш → `saveOnboardingAnswers` (stub) → `onComplete(answers)`.

См. [`SCREENS.md`](../../../SCREENS.md), [`review-panel/README.md`](../review-panel/README.md).
