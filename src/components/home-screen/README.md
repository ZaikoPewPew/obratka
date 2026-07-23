# `home-screen` — главная (хаб)

Path: **`/home`**. После onboarding: очередь портфолио на ревью, баланс (stub), CTA «подать своё».

## Поведение

Очередь: mock seed (`Наринэ`, `Janelle`) + поданные URL из localStorage (`obratka.submittedPortfolios`).  
После «Подать своё» item появляется в списке и открывается так же, как seed (`onOpenPortfolio` → `/review`).

## API

`createHomeScreen({ onOpenPortfolio, onAddPortfolio? })` → `{ root, open, close, setItems, refresh }`.

## Стили / i18n

`styles/home-screen.css`, токены `--home-screen-*`.  
Ключи: `homeTitle`, `homeListAria`, `homeEmpty`, `homeAddPortfolio`, `homeBalance`, `homeSubmitLocked`, `homeSubmitCost`.

См. [`SCREENS.md`](../../../SCREENS.md).
