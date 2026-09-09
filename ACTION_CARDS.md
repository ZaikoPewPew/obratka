# Action Cards + сводный отчёт

Сводка по **всем** листам с валидными `answers`. Карточки плана — по первым **`target_reviews`** (default 3), чтобы overshoot не ужесточал majority.

На `/report` кнопка «Скачать PDF» качает **сводный** документ. Личный PDF / side-panel одного ревьюера **без** action cards.

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
└── covers: structure_mess, structure_dump, metrics_none, context_low, cluster_impact
```

На резолве для каждой выбранной карточки подтягиваются ресурсы с `covers ∋ card.id`:

- до **2** обычных ссылок (не `example`);
- до **1** `example`;
- ранг: **`weight` ↓** (опц., default 0) → длина `covers` ↑ (уже = специфичнее) → **type diversity** (greedy: предпочитать ещё не занятый `types[0]`) → `id`;
- example URL **уникален** между карточками одного отчёта (второй без example, если URL занят).

Подписи ссылок — из `title.ru` / `title.en` ресурса (не из `locales`).

Ориентир `weight`: 90–100 канон по теме карточки · 60–80 сильный практический · 30–50 вторичный · 0–20 хвост. Пустой `covers` — библиотека (не в PDF), вес не влияет на выдачу.

`context_low`: не больше **10** non-example; канон ≥90 только у роли/задачи/Mom Test (`itagency_mom_test`, `uxfol_case_template`).

CV-источник (`hanna_cv`) и др. с пустым `covers` — в базе, в сводном PDF не светятся, пока нет card id.

## Поток

```text
sheets.answers
  → aggregate (все листы) → секции голосов + advice/dictation quotes
  → aggregate (limit = target) → вердикт / strengths / resolveActionCards
                ↘ buildConsensusReport → shareConsensusPdf
```

| Модуль | Роль |
|--------|------|
| [`src/data/actionCards.json`](src/data/actionCards.json) | id, category, trigger, priority; **без** UI-copy и URL |
| [`src/data/actionResources.json`](src/data/actionResources.json) | источники → `covers` card ids |
| [`src/utils/aggregatePortfolioReviews.js`](src/utils/aggregatePortfolioReviews.js) | counts / min–max / `adviceList` / `dictationList`; опц. `limit` |
| [`src/utils/resolveActionCards.js`](src/utils/resolveActionCards.js) | majority + кластеры + scoring → max 3 cards + resources |
| [`src/utils/buildConsensusReport.js`](src/utils/buildConsensusReport.js) | вердикт, strengths, голоса, карточки, цитаты |
| [`src/utils/shareConsensusPdf.js`](src/utils/shareConsensusPdf.js) | print iframe сводного PDF |

## Majority

`count > N/2` (N=3 → ≥2). Для **карточек / вердикта / strengths** N — число первых `target` листов, не overshoot.

Проблемные зоны:

| Ось | Триггер | Card id |
|-----|---------|---------|
| `structure` | `mess` / `dump` | `structure_*` |
| `metrics` | `none` / `vanity` | `metrics_*` |
| `context` | `1` / `2` | `context_low` |
| `visual` | majority ≤ 2 и нет pain-majority | `visual_weak` |
| `pain` | тег с majority | `pain_*` |

Tie лучших problem-value (например 1 mess / 1 dump / 1 clear) → **нет card**.  
`sum(problem) > N/2` при **уникальном** лидере → card.

Кластеры (гасят перекрытые оси):

| id | Условие |
|----|---------|
| `cluster_impact` | problem metrics + (structure **или** low context) |
| `cluster_gradeAboveTier` | majority senior+ grade **и** tier ∈ {early, mid} |
| `cluster_storyLost` | problem structure **и** majority visual ≥ 4 |

Порядок выдачи: scoring (вес оси × доля голосов + boost, если advice/dictation намекает на тему) → pain-reserve в top-3 (majority pain не выпадает) → max 3. Внутри pain при равном score — [`PAIN_PRIORITY`](src/utils/reviewReport.js). Нет проблем → блок «План действий» скрыт.

Dictation — цитаты с лейблом «мнение ревьюера», не факт и не LLM-вердикт.

## Формат сводки в PDF

1. **Главный вывод** — majority `tier × gradeZone` (тексты `reportSummary*`) или мягкий spread.  
2. **Что уже работает** — majority позитивных осей.  
3. Голоса по осям (все листы, включая overshoot).  
4. **План действий** — до 3 карточек (`{count} из {n}` + шаги + ссылки).  
5. Советы (`advice`) и заметки (`dictation`) списком.

Ключи голосов: `reportConsensus*Range` / `*Same` + `reportConsensusVoteOne|Few|Many|Other`.

## i18n

`reportConsensus*` · `reportAction*{Title,Problem,StepN,Category*,Confirmations}` — ru/en в `locales.json`.  
Подписи ссылок — в `actionResources.json` (`title` / `description`).
