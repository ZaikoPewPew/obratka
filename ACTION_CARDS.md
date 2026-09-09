# Action Cards + сводный отчёт

Сводка по **всем** листам с валидными `answers` и до **3** статичных рекомендаций — **только в общем PDF** (`shareConsensusPdf`). На экране `/report` сводки нет (список листов + личный PDF в панели).

Личный PDF одного ревьюера (`shareReviewPdf` / side-panel) **без** action cards.

## Куда править контент

| Что | Где |
|-----|-----|
| Карточки проблем (id / category / trigger / priority) | [`src/data/actionCards.json`](src/data/actionCards.json) — **без** URL |
| Источники (гайды / шаблоны / примеры) | [`src/data/actionResources.json`](src/data/actionResources.json) — `url`, `types`, `tags`, `covers`, опц. `weight`, `title` / `description` |
| Заголовки, проблемы, шаги карточек | [`content/locales.json`](content/locales.json) — ключи `reportAction*` (ru + en) |

## Модель источников

Источник — первичная сущность. Один материал может закрывать несколько card id:

```text
uxfol_case_template
├── types: guide, template
├── tags: storytelling, research, impact, …
└── covers: structure_mess, structure_dump, metrics_none, context_low
```

На резолве для каждой выбранной карточки подтягиваются ресурсы с `covers ∋ card.id`:

- до **2** обычных ссылок (не `example`);
- до **1** `example`;
- ранг: **`weight` ↓** (опц., default 0) → длина `covers` ↑ (уже = специфичнее) → **type diversity** (greedy: предпочитать ещё не занятый `types[0]`) → `id`.

Подписи ссылок — из `title.ru` / `title.en` ресурса (не из `locales`).

Ориентир `weight`: 90–100 канон по теме карточки · 60–80 сильный практический · 30–50 вторичный · 0–20 хвост. Пустой `covers` — библиотека (не в PDF), вес не влияет на выдачу.

CV-источник (`hanna_cv`) и др. с пустым `covers` — в базе, в сводном PDF не светятся, пока нет card id.

## Поток

```text
sheets.answers → aggregatePortfolioReviews → resolveActionCards
                              ↘ buildConsensusReport → shareConsensusPdf
                                         ↑
                              actionResources.covers
```

| Модуль | Роль |
|--------|------|
| [`src/data/actionCards.json`](src/data/actionCards.json) | id, category, trigger, priority; **без** UI-copy и URL |
| [`src/data/actionResources.json`](src/data/actionResources.json) | источники → `covers` card ids |
| [`src/utils/aggregatePortfolioReviews.js`](src/utils/aggregatePortfolioReviews.js) | counts / min–max / `adviceList` (dictation v1 не тащим) |
| [`src/utils/resolveActionCards.js`](src/utils/resolveActionCards.js) | majority → max 3 cards + attach resources |
| [`src/utils/buildConsensusReport.js`](src/utils/buildConsensusReport.js) | тексты сводки (многострочные голоса) + локализованные карточки |
| [`src/utils/shareConsensusPdf.js`](src/utils/shareConsensusPdf.js) | print iframe сводного PDF |

## Majority

`count > N/2` (N=3 → ≥2; N=4 → ≥3; N=5 → ≥3).

Проблемные зоны:

| Ось | Триггер | Card id |
|-----|---------|---------|
| `structure` | `mess` / `dump` | `structure_*` |
| `metrics` | `none` / `vanity` | `metrics_*` |
| `context` | `1` / `2` | `context_low` |
| `pain` | тег с majority | `pain_*` |

Categorical nuance: если оба проблемных value набрали голоса, но ни один сам по себе не majority, всё равно срабатываем при `sum(problem) > N/2` и берём value с max count (например mess vs dump).

Порядок: **structure → metrics → context → pain**; внутри pain — [`PAIN_PRIORITY`](src/utils/reviewReport.js) (`overloaded`, `contrast`, `composition`, `components`). Нет проблем → блок «План действий» скрыт.

## Формат сводки в PDF

Многострочно, например:

```text
От «С трудом» до «В целом понял» (3 из 3)
2 голоса «В целом понял»
1 голос «С трудом»
```

Ключи: `reportConsensus*Range` / `*Same` + `reportConsensusVoteOne|Few|Many|Other`.

## i18n

`reportConsensus*` · `reportAction*{Title,Problem,StepN,Category*}` — ru/en в `locales.json`.  
Подписи ссылок — в `actionResources.json` (`title` / `description`).
