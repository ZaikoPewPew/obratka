# `onboarding-screen` — онбординг

Path: **`/onboarding`**. После регистрации; split через [`brand-screen-shell`](../brand-screen-shell/README.md) + слева **те же паттерны, что у `review-panel`**.

## UI

Классы квиза 1:1: `review-panel__top` / `__back` / `__progress` / `__choice` / `__nav` / `__submit`, auto-advance по `single` (radio), кнопка «Далее» на `multi` (checkbox), motion шагов.

Порядок шагов: грейд → домен (multi) → ожидания (multi).  
Шаг specialization (`role`) временно `hidden: true` в [`content/onboarding.json`](../../../content/onboarding.json); в профиль пишется `product-designer` (`DEFAULT_ONBOARDING_ROLE`).  
Тексты — `onboarding*` в `locales.json`.

## Shell / visual

Монтируется на `createBrandScreenShell` (`markPending: true` — SVG марки вставляет экран).  
Правый visual: [`brand-screen-visual`](../brand-screen-visual/README.md) через shell (`getBrandVisual` / `setVariant`).  
Полей с `url-screen__error` здесь нет — шаги квиза, не text-input gate.

## API

`createOnboardingScreen({ onComplete })` → `{ root, open, close }`.

Финиш → `saveOnboardingAnswers` (`src/api/onboarding.js` → `public.profiles`: `role`, `grade`, `domains`, `goals`, `onboarding` jsonb, `onboarding_done: true`) → `onComplete(answers)` → `go("home")`.

**Grade** обязателен: по нему тихий матчинг лиг (лента / claim / INSERT). Матрица — `.cursor/rules/leagues.mdc`, клиент — [`src/api/leagues.js`](../../api/leagues.js).

См. [`SCREENS.md`](../../../SCREENS.md), [`review-panel/README.md`](../review-panel/README.md).
