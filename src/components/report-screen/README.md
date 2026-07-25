# `report-screen` — отчёт автору портфолио

Path: **`/report`** (`report`). Только для **автора** из вкладки «Мои».

## Сейчас

- Список завершённых листов ревью по `portfolioId`
- На каждом листе кнопка **«Пожаловаться»** → модалка с тегами (мультивыбор)
- Без жалобы лист считается «ок»; явного чипа «всё ок» нет
- Одна жалоба на лист (`review_complaints`, RPC `submit_review_complaint`) → штраф репутации ревьюера на сервере
- Справа: дефолт mesh + мокап листа; **Скачать PDF** можно много раз (лист снова выезжает → улетает → done)
- В строке листа — EN Title Case должность ревьюера (`formatPortfolioRole`: Senior Product Designer / Product Design Lead / Head Of Design)
- Секции листа из `answers` (шкалы + `advice` + опционально **`dictation`** / «Заметки с просмотра»)
- PDF: все ревьюеры, **1 дизайнер = 1 страница** (`shareReviewPdf`)
- CTA: серая «На главную» + тёмная «Скачать PDF»

## API

`createReportScreen({ onPrimary? })` → `{ root, open, close, getPortfolioId }`

```js
reportScreen.open({ portfolioId: item.id, portfolioName: item.name });
```

Клиент: [`src/api/reviewComplaints.js`](../../api/reviewComplaints.js) — `listPortfolioReviewSheets` (с `answers`) / `submitReviewComplaint`.  
PDF / секции: [`src/utils/reviewReport.js`](../../utils/reviewReport.js), [`src/utils/shareReviewPdf.js`](../../utils/shareReviewPdf.js).  
Надиктовка: [`src/lib/dictation/README.md`](../../lib/dictation/README.md).

## Стили

`styles/report-screen.css` + токены `--report-screen-*` / `--shell-review-report-*`.

См. [`SCREENS.md`](../../../SCREENS.md), [`supabase/sql/review_complaints.sql`](../../../supabase/sql/review_complaints.sql).
