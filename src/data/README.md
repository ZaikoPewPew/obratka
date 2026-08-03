# `src/data/` — статичные данные продукта

Не UI-copy локалей и не SQL. JSON, который читает клиент при сборке отчёта.

| Файл | Роль |
|------|------|
| `actionCards.json` | Карточки проблем: `id`, `category`, `trigger`, `priority`. **Без** URL и строк UI |
| `actionResources.json` | Источники (гайды / статьи / шаблоны / примеры): `url`, `types`, `tags`, `covers`, `title` / `description` (ru/en) |

Резолв: [`resolveActionCards.js`](../utils/resolveActionCards.js) → majority cards + ресурсы с `covers ∋ card.id`.  
SoT: [`ACTION_CARDS.md`](../../ACTION_CARDS.md).  
UI-тексты карточек (`reportAction*`) — в [`content/locales.json`](../../content/locales.json).
