# `app-modal`

Универсальная модалка по Figma **Modal**  
([node `460:1006`](https://www.figma.com/design/KhsEJRKjBaDm6xaj3zJh2s/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BA%D0%B0?node-id=460-1006)).

Каркас один; **тело** (title / description / слот / кнопки) меняется по кейсу.  
Не экран флоу — не пишет `history`, не вызывает `go()`. Монтаж и оркестрация снаружи (экран / `main.js`).

## Макет → код

| Figma | Код |
|-------|-----|
| Size=600 | `size: "md"` → `--app-modal-width-md` |
| Size=800 | `size: "lg"` → `--app-modal-width-lg` |
| Size=Size3 (1000) | `size: "xl"` → `--app-modal-width-xl` |
| Заголовок + Описание | `title` / `description` |
| Close 56×56, radius 16 | `.app-modal__close` |
| Красная зона `#EA4335` | слот `.app-modal__content` (**без** красного фона — только placeholder в макете) |
| Primary (тёмная) / Secondary (muted) | `.app-modal__btn--primary` / `--secondary` |

Padding 32, gap секций 16, radius диалога 24 — всё через `--app-modal-*`.

## Файлы

| Файл | Роль |
|------|------|
| [`AppModal.js`](AppModal.js) | фабрика `createAppModal` |
| [`styles/app-modal.css`](../../../styles/app-modal.css) | разметка + open/close motion |
| [`styles/tokens.css`](../../../styles/tokens.css) | `--app-modal-*` |
| `content/locales.json` | `modalCloseAria` (дефолт close) |

Подключение CSS: `index.html` → после `entrance.css`.

## API

```js
import { createAppModal } from "../app-modal/AppModal.js";

const modal = createAppModal({
  size: "md",                 // "md" | "lg" | "xl"
  title: "…",                 // или setTitle позже
  description: "…",           // пусто → скрыт
  primaryLabel: "…",
  secondaryLabel: "…",
  showPrimary: true,          // default: есть label
  showSecondary: true,
  closeAriaLabel: undefined,  // иначе getStrings().modalCloseAria
  closeOnBackdrop: true,
  closeOnEscape: true,
  onPrimary: () => { /* … */ },
  onSecondary: () => { void modal.close(); },
  onClose: () => { /* после анимации закрытия */ },
});

document.body.append(modal.root);

// Кастомный контент = красная зона в Figma
modal.content.append(customNode);

modal.open();
await modal.close();
```

### Возвращает

| Метод / поле | Назначение |
|--------------|------------|
| `root` | backdrop (его вешают в DOM) |
| `dialog` | панель `role="dialog"` |
| `content` | слот под кастомный DOM кейса |
| `open()` / `close()` | `close` → `Promise` после fade |
| `isOpen()` | backdrop открыт + класс `--open` |
| `setSize(size)` | `md` / `lg` / `xl` |
| `setTitle` / `setDescription` | копирайт |
| `setPrimaryLabel` / `setSecondaryLabel` | кнопки |
| `setActionsVisible({ primary, secondary })` | скрыть ряд / кнопки |
| `setCloseAriaLabel` | aria у крестика |

### Опции создания

| Опция | Default | Смысл |
|-------|---------|--------|
| `size` | `"md"` | ширина |
| `title` / `description` | `""` | шапка |
| `primaryLabel` / `secondaryLabel` | `""` | без label → кнопка скрыта |
| `showPrimary` / `showSecondary` | `true` если есть label | явный override |
| `closeOnBackdrop` / `closeOnEscape` | `true` | закрытие |
| `onClose` / `onPrimary` / `onSecondary` | — | колбэки |

## i18n

- Каркас **не** знает тексты кейса — их передаёт вызывающий код через `getStrings()` / ключи экрана.
- Дефолт крестика: `modalCloseAria` (`Закрыть` / `Close`).
- Не хардкодить UI-строки в `AppModal.js`.

## Стили и motion

Токены `--app-modal-*` (алиасы на семантику / `--motion-reveal-*`).

| Слой | Поведение |
|------|-----------|
| Backdrop | `opacity` → `--app-modal-backdrop-duration/ease` (`--motion-screen-*`) |
| Dialog | scale + `translateY` + blur → `--app-modal-dialog-*` (`--motion-reveal-*`) |
| Open | `hidden=false` → rAF → класс `app-modal--open` |
| Close | снять `--open` → `transitionend` opacity / fallback `getScreenCloseFallbackMs()` |
| Reduced motion | без transform/blur, почти мгновенный transition |

Классы размера на `root`: `app-modal--size-md` / `--lg` / `--xl`.

## Поведение

- `role="dialog"` + `aria-modal="true"` + `aria-labelledby` (+ `aria-describedby`, если есть description)
- Focus: open → кнопка close; close → предыдущий `activeElement`
- Escape / клик по backdrop → `close()` (флаги отключают)
- Пустой `content` скрыт (`:empty`); пустой ряд actions — `hidden`
- **Не** писать `history` / `go()` внутри модалки

## Когда использовать

| Да | Нет / пока отдельно |
|----|---------------------|
| Новый кейс с title + слот + 1–2 CTA | Inline notice без оверлея |
| Общий каркас под разные тела | Ban / brand split-экраны |
| | Legacy home locked / invite / report complaint — пока свои DOM; миграция по задаче |

## Связанные доки

- Компоненты: [`../README.md`](../README.md)
- Токены / CSS: [`../../../styles/README.md`](../../../styles/README.md)
- Локали: [`../../../content/README.md`](../../../content/README.md)
- Продукт / слои UI: [`../../../PROJECT.md`](../../../PROJECT.md)
- Карта агента: [`.cursor/README.md`](../../../.cursor/README.md)
