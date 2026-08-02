# Action Cards + сводный отчёт

Сводка по **всем** листам с валидными `answers` и до **3** статичных рекомендаций на `/report` и в общем PDF.

Личный PDF одного ревьюера (`shareReviewPdf` / side-panel) **без** action cards.

## Поток

```text
sheets.answers → aggregatePortfolioReviews → resolveActionCards
                              ↘ buildConsensusReport → UI / shareConsensusPdf
```

| Модуль | Роль |
|--------|------|
| [`src/data/actionCards.json`](src/data/actionCards.json) | id, category, trigger, priority, urls (`links` / `example`); **без** UI-copy |
| [`src/utils/aggregatePortfolioReviews.js`](src/utils/aggregatePortfolioReviews.js) | counts / min–max / `adviceList` (dictation v1 не тащим) |
| [`src/utils/resolveActionCards.js`](src/utils/resolveActionCards.js) | majority → max 3 cards |
| [`src/utils/buildConsensusReport.js`](src/utils/buildConsensusReport.js) | тексты сводки + локализованные карточки |
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

## i18n / UI

Ключи: `reportConsensus*`, `reportAction*` в [`content/locales.json`](content/locales.json).  
Экран: [`report-screen`](src/components/report-screen/README.md) — сводка + карточки над списком листов; «Скачать PDF» → consensus.  
Токены: `--report-action-*` в `styles/tokens.css`.

Тесты: [`src/utils/consensusActionCards.test.js`](src/utils/consensusActionCards.test.js).
