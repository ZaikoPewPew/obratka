# `url-screen` — подача своего портфолио

Path: **`/portfolio`**. Ввод URL со своего Home (нужен баланс ≥ cost).

## Роль

**Эталон visual** для split-экранов: левая форма + правый mesh/бренд.  
Referral / auth / onboarding опираются на `.url-screen*`; цель — общий `brand-screen-shell`.

См. [`SCREENS.md`](../../../SCREENS.md).

## Файл

- `UrlScreen.js` — `createUrlScreen({ onSubmit })` → `{ root, open, close }`.
- `open(prefill?, { handoff? })`, `close({ handoff? })` через `brandScreenTransition.js`.

## Поведение

Submit валидного URL → `onSubmit(url)` → в `main.js`: `spendSubmitCost` + `submitPortfolio` → `go("done")` с preset `portfolioSubmitted` (без запуска review).

Ревью чужого портфолио стартует с Home (`onOpenPortfolio` → `/review`), не с этого экрана.

## Motion

При `open()` без handoff: `.url-screen--open`, staggered reveal (`--url-screen-reveal-delay-*` → `--motion-delay-*`).  
С `handoff: true`: visual/brand без анимации (соседний brand-экран).

## Стили

`.url-screen*` в `iframe-shell.css`, токены `--url-screen-*` в `tokens.css`.
