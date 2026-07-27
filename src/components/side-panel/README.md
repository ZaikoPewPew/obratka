# `side-panel`

Боковая панель справа по Figma **SidePanel**  
([node `517:4740`](https://www.figma.com/design/KhsEJRKjBaDm6xaj3zJh2s/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BA%D0%B0?node-id=517-4740)).

Каркас один; **тело** (слот `content`) меняется по кейсу.  
Не экран флоу — не пишет `history`, не вызывает `go()`. Монтаж и оркестрация снаружи.

## Макет → код

| Figma | Код |
|-------|-----|
| Панель 500×высота экрана | `--side-panel-width` + `top/right/bottom: inset` |
| Inset 16 сверху / справа / снизу | `--side-panel-inset` |
| Radius 24, padding 24, gap 16 | `--side-panel-*` |
| Title 24 + muted subtitle 14 | `.side-panel__title` / `__description` |
| Close 56×56, radius 16 | `.side-panel__close` |
| Текст правил | слот `.side-panel__content` (+ `__intro` / `__section*`) |

Waitlist-низ из болванки макета (инпут / аватары) **не** переносится.

## Файлы

| Файл | Роль |
|------|------|
| [`SidePanel.js`](SidePanel.js) | фабрика `createSidePanel` |
| [`styles/side-panel.css`](../../../styles/side-panel.css) | разметка + open/close motion |
| [`styles/tokens.css`](../../../styles/tokens.css) | `--side-panel-*` |

Подключение CSS: `index.html` → рядом с `app-modal.css`.

## API

```js
import { createSidePanel } from "../side-panel/SidePanel.js";

const panel = createSidePanel({
  title: "…",
  description: "…",
  closeAriaLabel: undefined, // иначе getStrings().modalCloseAria
  closeOnBackdrop: true,
  closeOnEscape: true,
  onClose: () => { /* после анимации */ },
});

document.body.append(panel.root);
panel.content.append(customNode);
panel.open();
await panel.close();
```

### Возвращает

| Метод / поле | Назначение |
|--------------|------------|
| `root` | backdrop (его вешают в DOM) |
| `panel` | панель `role="dialog"` |
| `content` | слот под кастомный DOM |
| `open()` / `close()` | `close` → `Promise` после fade |
| `isOpen()` | backdrop открыт + класс `--open` |
| `setTitle` / `setDescription` | копирайт шапки |
| `setCloseAriaLabel` | aria у крестика |

## Поведение

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Focus: open → close; close → предыдущий `activeElement`
- Escape / клик по backdrop → `close()`
- Slide-in справа + fade backdrop; reduced motion — без сдвига
- **Не** писать `history` / `go()` внутри

## Кейс на home

Account-menu → «Правила» → `homeRules*` в слоте (intro + секции).

## Связанные доки

- [`../account-menu/README.md`](../account-menu/README.md)
- [`../app-modal/README.md`](../app-modal/README.md)
- [`../../../styles/README.md`](../../../styles/README.md)
