# `home-screen` — главная (очередь на ревью)

Главная после referral → auth → onboarding. Список портфолио, которые нужно отревьюить.

## Визуал

**Не** brand-shell split. Отдельный лейаут списка/очереди (`styles/home-screen.css`).

Свой entrance (при реализации): не копировать url-screen reveal один в один — список/строки, не split.

## Файл

- `HomeScreen.js` — `createHomeScreen({ onOpenPortfolio, onAddPortfolio? })` → `{ root, open, close, setItems }`.
- Статус: **каркас** с пустым списком / empty state, не монтируется из `main.js`.

## Поведение (план)

1. Загрузка очереди через `src/api/portfolios.js` (на этапе UI — mock).
2. Элемент списка: имя / host, favicon (`portfolioMeta`), статус.
3. `onOpenPortfolio(item)` → существующий путь сессии (`url-screen` или сразу iframe-shell — решить при склейке флоу).
4. Пустое состояние + CTA добавить — ключи `homeEmpty`, `homeAddPortfolio`.

## i18n

Ключи `homeTitle`, `homeListAria`, `homeEmpty`, `homeAddPortfolio` в `content/locales.json`.

## Зависимости

- `src/api/portfolios.js`
- `src/utils/portfolioMeta.js` (имя, favicon)
- `src/app/flow.js`

См. [`SCREENS.md`](../../../SCREENS.md).
