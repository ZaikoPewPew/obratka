# `report-screen` — отчёт автору портфолио

Path: **`/report`** (`report`). Только для **автора** из вкладки «Мои».

## Сейчас

- Список завершённых листов ревью по `portfolioId`
- На каждом листе кнопка **«Пожаловаться»** → модалка с тегами (мультивыбор)
- Без жалобы лист считается «ок»; явного чипа «всё ок» нет
- Одна жалоба на лист (`review_complaints`, RPC `submit_review_complaint`) → штраф репутации ревьюера на сервере

Агрегат PDF/сводка оценок — по-прежнему roadmap.

## API

`createReportScreen({ onPrimary? })` → `{ root, open, close, getPortfolioId }`

```js
reportScreen.open({ portfolioId: item.id });
```

Клиент: [`src/api/reviewComplaints.js`](../../api/reviewComplaints.js) — `listPortfolioReviewSheets` / `submitReviewComplaint`.

## Стили

`styles/report-screen.css` + токены `--report-screen-*`.

См. [`SCREENS.md`](../../../SCREENS.md), [`supabase/sql/review_complaints.sql`](../../../supabase/sql/review_complaints.sql).
