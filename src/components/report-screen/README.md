# `report-screen` — отчёт автору портфолио (каркас)

Path: **`/report`** (`report`). Только для **автора** из вкладки «Мои посты».

## Сейчас

Оболочка как у `success-screen` / done: тайтл + body-заглушка + «На главную», справа зелёный mesh. Контент агрегата ревью — позже.

## API

`createReportScreen({ onPrimary? })` → `{ root, open, close, getPortfolioId }`

```js
reportScreen.open({ portfolioId: item.id });
```

## Стили

`styles/report-screen.css` + токены `--report-screen-*` (алиасы на success).

См. [`SCREENS.md`](../../../SCREENS.md).
