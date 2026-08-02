# Action Cards + сводный отчёт

Сводка по **всем** листам с валидными `answers` и до **3** статичных рекомендаций — **только в общем PDF** (`shareConsensusPdf`). На экране `/report` сводки нет (список листов + личный PDF в панели).

Личный PDF одного ревьюера (`shareReviewPdf` / side-panel) **без** action cards.

## Куда править контент

| Что | Где |
|-----|-----|
| URL гайдов / шаблонов / примеров | [`src/data/actionCards.json`](src/data/actionCards.json) — поля `links[].url`, `example.url` |
| Заголовки, проблемы, шаги, подписи ссылок | [`content/locales.json`](content/locales.json) — ключи `reportAction*` (ru + en) |

## Поток

```text
sheets.answers → aggregatePortfolioReviews → resolveActionCards
                              ↘ buildConsensusReport → shareConsensusPdf
```

| Модуль | Роль |
|--------|------|
| [`src/data/actionCards.json`](src/data/actionCards.json) | id, category, trigger, priority, urls (`links` / `example`); **без** UI-copy |
| [`src/utils/aggregatePortfolioReviews.js`](src/utils/aggregatePortfolioReviews.js) | counts / min–max / `adviceList` (dictation v1 не тащим) |
| [`src/utils/resolveActionCards.js`](src/utils/resolveActionCards.js) | majority → max 3 cards |
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

`reportConsensus*` · `reportAction*` — ru/en в `locales.json`.
