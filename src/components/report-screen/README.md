# `report-screen` — отчёт автору портфолио

Path: **`/report`** (`report`). Только для **автора** из вкладки «Мои».

Вход с home «Мои» только после `reviewsCount >= targetReviews` (`onOpenReport`); иначе home показывает `homeMineNotReady*` и сюда не ведёт. Листов может быть **больше target** (in-flight overshoot): список, жалобы и PDF показывают **все** rows, без cap на 3. На карточке home по-прежнему первые `target` аватарок — см. [`PROJECT.md`](../../../PROJECT.md) § Claims.

## Сейчас

- Список завершённых листов ревью по `portfolioId`; пока грузится — skeleton-строки (`--report-screen-skeleton-*`), без текста-заглушки
- На каждом листе с `answers` кнопка **«Посмотреть»** → `createSidePanel` с полным текстом листа (`buildReportSections`, `mode: "full"`)
- Sticky footer панели: **«Скачать PDF»** (только этот лист) + **«Пожаловаться»** → модалка с тегами (**ровно 1** причина; окно **6 часов** после `done` портфолио / готовности отчёта). Без просмотра листа жаловаться нельзя
- Side-panel / complaint-modal монтируются в `document.body` (не внутрь `.report-screen`: иначе `transform`/`filter` клипают sticky footer)
- Без жалобы лист считается «ок»; явного чипа «всё ок» нет
- Одна жалоба на лист (`review_complaints`, RPC `submit_review_complaint`) → штраф репутации ревьюера на сервере (−20); после окна без жалобы ревьюер получает +10 (`settle_review_reputation_rewards`)
- Справа: дефолт mesh + мокап листа; **Скачать PDF** на экране качает **все** листы (лист снова выезжает → улетает → done); в панели — только открытый лист
- В строке листа — EN Title Case должность ревьюера (`formatPortfolioRole`: Senior Product Designer / Product Design Lead / Head Of Design)
- Секции листа из `answers` через `buildReportSections` (`mode: "full"`): L2 кросс-сигналы, L1, pain, итог `tier × gradeZone` + `reportSummaryLead`, `advice`, опц. **`dictation`**. Схема полей — [`QUIZ.md`](../../../QUIZ.md). Старые листы с `hire` / visual 1–10 **не** распарсятся.
- PDF: все ревьюеры, **1 дизайнер = 1 страница** (`shareReviewPdf`)
- CTA: серая «На главную» + тёмная «Скачать PDF» (пока нет листов — та же тёмная, только `cursor: not-allowed`)

## Просмотр листа (side-panel)

- Каркас: [`createSidePanel`](../side-panel/README.md) — title = имя ревьюера, description = грейд/роль
- Тело: секции через `.side-panel__section*` (скролл)
- Sticky footer (как header): **«Скачать PDF»** (только этот лист) + **«Пожаловаться»** / «Жалоба отправлена»
- Вне окна 6ч кнопку жалобы **скрывать** (не disabled «Срок жалобы истёк»); PDF остаётся
- Escape / backdrop закрывают панель; при уходе с `/report` панель тоже закрывается

## Жалоба (теги v1)

Модалка — `createAppModal` (`size: "md"`): sticky header (title + «Обратная связь от {name}» + close) / sticky actions («Туда его!» / «Да не, не стоит»); в слоте скроллятся tip + теги. Выбранный тег: фон `--color-choice-selected` (`#8BB5FF`), текст белый. Открывается **из панели** просмотра листа.

| Тег | Ключ i18n |
|-----|-----------|
| `low_effort` | `complaintTagLowEffort` |
| `spam` | `complaintTagSpam` |
| `harassment` | `complaintTagHarassment` |
| `offensive` | `complaintTagOffensive` |
| `ai_slop` | `complaintTagAiSlop` |

- **Не** добавлять теги «не согласен с грейдом» / useful-useless.
- Веса и порог бана — **только SQL**; в UI и explainer репутации на home весов нет.
- Штраф = вес выбранного тега (−20); при `reputation <= -100` → автобан (`ban_reason = reputation`). Старт 0; +10 после окна без жалобы.
- Ревьюер не видит `reporter_id`.

Правило: `.cursor/rules/reputation.mdc`. Оператор / разбан: [`supabase/BAN.md`](../../../supabase/BAN.md).

**Вне v1 (не делать без задачи):** `misleading`, очередь модерации, троттлинг жалобщиков, редизайн списка листов.

## API

`createReportScreen({ onPrimary? })` → `{ root, open, close, getPortfolioId }`

```js
reportScreen.open({ portfolioId: item.id, portfolioName: item.name });
```

Клиент: [`src/api/reviewComplaints.js`](../../api/reviewComplaints.js) — `listPortfolioReviewSheets` (с `answers`) / `submitReviewComplaint`.  
PDF / секции: [`src/utils/reviewReport.js`](../../utils/reviewReport.js), [`src/utils/shareReviewPdf.js`](../../utils/shareReviewPdf.js).  
Спека квиза и трактовок: [`QUIZ.md`](../../../QUIZ.md).  
Надиктовка: [`src/lib/dictation/README.md`](../../lib/dictation/README.md).  
Post-edit пунктуации (перед сохранением в лист): [`supabase/functions/polish-dictation/README.md`](../../../supabase/functions/polish-dictation/README.md).

## Стили

`styles/report-screen.css` + токены `--report-screen-*` / `--shell-review-report-*`.  
Строка списка / кнопка жалобы в панели: `.report-screen__sheet-action`.  
На короткой visual лист clamp’ится ≥ `--shell-review-report-gap-below-brand` под лого (`--shell-review-report-shift-shown-effective`).

См. [`SCREENS.md`](../../../SCREENS.md), [`supabase/sql/review_complaints.sql`](../../../supabase/sql/review_complaints.sql), [`PROJECT.md`](../../../PROJECT.md) § Репутация.
