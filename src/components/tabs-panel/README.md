# `tabs-panel`

Сегментированный переключатель табов. Трек **hug** к подписям (`width: fit-content`), по центру колонки карточек.

Shared UI: не экран флоу — не пишет `history`, не вызывает `go()`. Монтаж и оркестрация снаружи (экран / `main.js`).

## Макет → код

| Макет | Код |
|-------|-----|
| Track hug ×48, radius pill, центр колонки | `.tabs-panel` → `--tabs-panel-width` (`fit-content`) / `--tabs-panel-align-self` (`center`) / `--tabs-panel-height` / `--tabs-panel-radius` / `--tabs-panel-bg` |
| Padding 4 | `--tabs-panel-padding` = `--space-1` |
| Tab hug ×40, radius pill | `.tabs-panel__tab` → `--tabs-panel-tab-*` (`flex: 0 0 auto`) |
| Tab padding-y 4 | `--tabs-panel-tab-padding-y` = `--space-1` (под высоту 40) |
| Active `#242426` + white | `--tabs-panel-tab-active-bg` / `--tabs-panel-tab-active-color` |
| Inactive transparent + `#242426` | `--tabs-panel-tab-color` |
| Montserrat 16 regular | `--font-size-base` / `--font-weight-regular` |
| Dot 7×7, Google red, после подписи, gap 8px | `.tabs-panel__tab-dot` → `--tabs-panel-tab-dot-*` |

В макете фон активного таба статичен; в коде — скользящий `.tabs-panel__thumb` (`transform` + `width`, `--tabs-panel-thumb-*`), у кнопок меняется только `color`. `ResizeObserver` / `window.resize` синчат thumb **без** `instant` (как home tabbar) — иначе layout после смены сегмента съедает анимацию.

Подпись таба — в `.tabs-panel__tab-label`, чтобы `setLabels` не затирал точку.

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
    { id: "active", label: "Разбор" },
    { id: "completed", label: "Разобрано" },
  ],
  activeId: "active",
  ariaLabel: "Фильтр моих постов",
  onChange: (id) => {
    /* id: "active" | "completed" */
  },
});

panel.setLabels({ active: "Review", completed: "Reviewed" });
panel.setAriaLabel("My posts filter");
panel.setActive("completed"); // с анимацией thumb
panel.setActive("active", { instant: true }); // без анимации
panel.setTabDot("completed", true); // красная точка справа (сейчас UI off: `TAB_DOT_ENABLED`)
panel.syncThumb(true); // после unhide / layout
panel.getActive(); // "active"
```

`instant: true` в том же кадре после анимированного `setActive` съедает анимацию:
sync-функции хоста должны сначала сверяться с `getActive()` и переставлять thumb
мгновенно только при реальном рассинхроне (смена вкладки, unhide, внешний `setView`).

## Где используется

- [`home-screen`](../home-screen/README.md) — один сегмент над списком на вкладках **Лента** («Разбор / Разобрано») и **Мои посты** («Разбор / Разобрано»); точка на `completed` только на «Мои» при непросмотренном 3/3. **Сейчас UI off** — `TAB_DOT_ENABLED = false` в [`TabsPanel.js`](TabsPanel.js) (`setTabDot` no-op на показ). Трек hug к подписям, по центру колонки карточек.
