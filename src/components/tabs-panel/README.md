# `tabs-panel`

Сегментированный переключатель табов по Figma **tabspanel**  
([node `476:1762`](https://www.figma.com/design/KhsEJRKjBaDm6xaj3zJh2s/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BA%D0%B0?node-id=476-1762)).

Shared UI: не экран флоу — не пишет `history`, не вызывает `go()`. Монтаж и оркестрация снаружи (экран / `main.js`).

## Макет → код

| Figma | Код |
|-------|-----|
| Track 500×59, radius pill, `#f3f4f7` | `.tabs-panel` → `--tabs-panel-height` / `--tabs-panel-radius` / `--tabs-panel-bg` |
| Padding 4 | `--tabs-panel-padding` = `--space-1` |
| Tab ~244×51, radius pill | `.tabs-panel__tab` → `--tabs-panel-tab-*` |
| Active `#242426` + white | `--tabs-panel-tab-active-bg` / `--tabs-panel-tab-active-color` |
| Inactive transparent + `#242426` | `--tabs-panel-tab-color` |
| Montserrat 16 regular | `--font-size-base` / `--font-weight-regular` |

Без sliding thumb — активный таб заливается целиком.

## Файлы

| Файл | Роль |
|------|------|
| [`TabsPanel.js`](TabsPanel.js) | фабрика `createTabsPanel` |
| [`styles/tabs-panel.css`](../../../styles/tabs-panel.css) | разметка |
| [`styles/tokens.css`](../../../styles/tokens.css) | `--tabs-panel-*` |

Подключение CSS: `index.html` → рядом с `home-screen.css`.

## API

```js
import { createTabsPanel } from "../tabs-panel/TabsPanel.js";

const panel = createTabsPanel({
  tabs: [
    { id: "active", label: "Активные" },
    { id: "archived", label: "Архивные" },
  ],
  activeId: "active",
  ariaLabel: "Фильтр моих постов",
  onChange: (id) => {
    /* id: "active" | "archived" */
  },
});

panel.setLabels({ active: "Active", archived: "Archived" });
panel.setAriaLabel("My posts filter");
panel.setActive("archived");
panel.getActive(); // "archived"
```

## Где используется

- [`home-screen`](../home-screen/README.md) — фильтр «Активные / Архивные» над списком вкладки «Мои посты».
