# `onboarding-screen` — онбординг

Path: **`/onboarding`**. После регистрации; split через [`brand-screen-shell`](../brand-screen-shell/README.md) + слева **те же паттерны, что у `review-panel`**.

## UI

Классы квиза 1:1: `review-panel__top` / `__back` / `__progress` / `__choice` / `__nav` / `__submit`, auto-advance по `single` (radio), кнопка «Далее» на `multi` (checkbox), motion шагов.

Порядок шагов: грейд → домен (multi) → ожидания (multi) → **«Начать»**.  
Шаги specialization (`role`) и video (`watch`) временно `hidden: true` в [`content/onboarding.json`](../../../content/onboarding.json); в профиль для role пишется `product-designer` (`DEFAULT_ONBOARDING_ROLE`).  
Тексты — `onboarding*` / `videoPlayer*` в `locales.json`.

### Шаг video (скрыт)

Код и [`VideoPlayerCard`](../video-player-card/README.md) (**340×602**) остаются; ролик [`welcome-reels.MOV`](../../assets/video/welcome-reels.MOV) (ключ `welcome`). Снять `hidden` у `watch` — вернуть шаг.

Пока video скрыт, **«Начать»** (`onboardingFinish`) на последнем видимом шаге (`goal`) в обычном footer. Если video снова в UI: CTA под плеером (`--onboarding-video-cta-*`), unlock после первого `ended`, `finish()` гейтится `videoCtaUnlocked`.

Ответ video-шага не собирается и не пишется в `profiles`.
## Shell / visual

Монтируется на `createBrandScreenShell` (`markPending: true` — SVG марки вставляет экран).  
Правый visual: [`brand-screen-visual`](../brand-screen-visual/README.md) через shell (`getBrandVisual` / `setVariant`).  
Полей с `url-screen__error` здесь нет — шаги квиза, не text-input gate.

## API

`createOnboardingScreen({ onComplete })` → `{ root, open, close }`.

Финиш → `saveOnboardingAnswers` (`src/api/onboarding.js` → `public.profiles`: `role`, `grade`, `domains`, `goals`, `onboarding` jsonb, `onboarding_done: true`) → `onComplete(answers)` → `go("home")`.

**Grade** обязателен: по нему тихий матчинг лиг (лента / claim / INSERT). Матрица — `.cursor/rules/leagues.mdc`, клиент — [`src/api/leagues.js`](../../api/leagues.js).

См. [`SCREENS.md`](../../../SCREENS.md), [`review-panel/README.md`](../review-panel/README.md).
