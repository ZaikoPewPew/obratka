# `side-panel`

Боковая панель справа по Figma **SidePanel**  
([node `517:4740`](https://www.figma.com/design/KhsEJRKjBaDm6xaj3zJh2s/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BA%D0%B0?node-id=517-4740)).

Каркас один; **тело** (слот `content`) и опциональный **footer** меняются по кейсу.  
Не экран флоу — не пишет `history`, не вызывает `go()`. Монтаж и оркестрация снаружи.

Header и footer **зафиксированы** (`flex-shrink: 0` / `flex: 0 0 auto`); скроллится только `.side-panel__content` (`flex: 1 1 0`) — как в `app-modal`.  
Report монтирует sheet-panel в `document.body`, не внутрь экрана с `transform`/`filter`.

## Макет → код

| Figma | Код |
|-------|-----|
| Панель 650×высота экрана | `--side-panel-width` + `top/right/bottom: inset` |
| Inset 16 сверху / справа / снизу | `--side-panel-inset` |
| Radius 24, padding 24, gap 16; секции body 24 | `--side-panel-*` / `--side-panel-body-gap` |
| Title 24 + muted subtitle 14 | `.side-panel__title` / `__description` |
| Close 56×56, radius 16 | `.side-panel__close` |
| Текст правил | слот `.side-panel__content` (+ `__intro` / `__section*`) |
| Sticky CTA (report) | слот `.side-panel__footer` |

Waitlist-низ из болванки макета (инпут / аватары) **не** переносится.

## Файлы

| Файл | Роль |
|------|------|
| [`SidePanel.js`](SidePanel.js) | фабрика `createSidePanel` |
| [`styles/side-panel.css`](../../../styles/side-panel.css) | разметка + open/close motion |
| [`styles/tokens.css`](../../../styles/tokens.css) | `--side-panel-*` |

Подключение CSS: импорт в `SidePanel.js` (как `app-modal.css` у `AppModal`) — иначе lazy-экраны без своего import оставят панель без стилей.

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
| `content` | слот под кастомный DOM (скролл) |
| `footer` | sticky низ (CTA); пустой скрыт (`:empty`) |
| `open()` / `close()` | `close` → `Promise` после fade |
| `isOpen()` | backdrop открыт + класс `--open` |
| `setTitle` / `setDescription` | копирайт шапки |
| `setCloseAriaLabel` | aria у крестика |

## Стили и motion

Токены `--side-panel-*` (алиасы на семантику / `--motion-reveal-*` / `--motion-screen-*`).

| Слой | Поведение |
|------|-----------|
| Backdrop | `opacity` → `--side-panel-backdrop-*` |
| Panel | только `translateX` (`--side-panel-panel-shift` = `100% + inset`); **без** fade opacity |
| Open | `hidden=false` → rAF → класс `side-panel--open` |
| Close | снять `--open` → `transitionend` на `transform` панели / fallback |
| Reduced motion | без сдвига, почти мгновенный transition |

## Поведение

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby`
- Focus: open → close; close → предыдущий `activeElement`
- Escape / клик по backdrop → `close()`
- **Не** писать `history` / `go()` внутри

## Кейсы

### Home — правила

Account-menu → «Правила» → текст из [`content/rules.json`](../../../content/rules.json) через `getCommunityRules()` (`homeRulesCloseAria` — только aria крестика в locales). Строки `body` (через `\n`) рендерятся как маркированный список (`.side-panel__section-list`).

### Report — просмотр листа

`/report` → «Посмотреть» на строке листа → полный текст (`buildReportSections`) в `content` + sticky footer: «Скачать PDF» (один лист) + «Пожаловаться». См. [`../report-screen/README.md`](../report-screen/README.md).

### Settings — профиль

`/settings` → `createSettingsScreen` монтирует view-only форму в `content` (footer пустой) поверх home. См. [`../settings-screen/README.md`](../settings-screen/README.md).

## Связанные доки

- [`../account-menu/README.md`](../account-menu/README.md)
- [`../report-screen/README.md`](../report-screen/README.md)
- [`../app-modal/README.md`](../app-modal/README.md)
- [`../../../content/README.md`](../../../content/README.md)
- [`../../../styles/README.md`](../../../styles/README.md)
