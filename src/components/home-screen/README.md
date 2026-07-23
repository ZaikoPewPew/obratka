# `home-screen` — главная (очередь на ревью)

Path: **`/home`**. После onboarding: список портфолио на ревью.

## Статус

**Stub** (title + empty list). Монтируется из `main.js`, deep link работает. В happy-path пока не открывается.

## Визуал

**Не** brand-shell. Отдельный лейаут (`styles/home-screen.css` — заготовка).

## Файл

- `HomeScreen.js` — `createHomeScreen({ onOpenPortfolio, onAddPortfolio? })` → `{ root, open, close, setItems }`.

## План

1. Очередь через `src/api/portfolios.js` (mock на этапе UI).
2. Строка: имя / host, favicon (`portfolioMeta`), статус.
3. `onOpenPortfolio` → `/portfolio` или сразу `/review`.
4. Empty + CTA: `homeEmpty`, `homeAddPortfolio`.

## i18n

`homeTitle`, `homeListAria`, `homeEmpty`, `homeAddPortfolio`.

См. [`SCREENS.md`](../../../SCREENS.md).
