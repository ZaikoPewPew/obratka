# `onboarding-screen` — онбординг

Path: **`/onboarding`**. После регистрации; split url-screen + слева **те же паттерны, что у `review-panel`**.

## UI

Классы квиза 1:1: `review-panel__top` / `__back` / `__progress` / `__choice` / `__nav` / `__submit`, auto-advance по `single` (radio), кнопка «Далее» на `multi` (checkbox), motion шагов.

Порядок шагов: специализация → грейд → домен (multi) → ожидания (multi).  
Тексты — `onboarding*` в `locales.json`. Контент — [`content/onboarding.json`](../../../content/onboarding.json).

## API

`createOnboardingScreen({ onComplete })` → `{ root, open, close }`.

Финиш → `saveOnboardingAnswers` (`src/api/onboarding.js` → `public.profiles`: `role`, `grade`, `domains`, `goals`, `onboarding` jsonb, `onboarding_done: true`) → `onComplete(answers)` → `go("home")`.

См. [`SCREENS.md`](../../../SCREENS.md), [`review-panel/README.md`](../review-panel/README.md).
