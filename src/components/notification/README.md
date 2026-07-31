# `notification` — toast

Тост по Figma **Notification**  
([node `542:1153`](https://www.figma.com/design/KhsEJRKjBaDm6xaj3zJh2s/%D0%9E%D0%B1%D1%80%D0%B0%D1%82%D0%BA%D0%B0?node-id=542-1153)).

Не экран флоу — не пишет `history`, не вызывает `go()`. Монтаж и оркестрация снаружи (home / `main.js`).

## Макет → код

| Figma | Код |
|-------|-----|
| Фон `#242426`, radius 16, padding 16 | `--notification-bg` / `--notification-radius` / `--notification-padding` |
| Иконка error 24 + текст 14 Montserrat + close 24 | `.notification__icon` / `__message` / `__close` |
| Gap 8 между элементами | `--notification-gap` |
| Close скрыт по умолчанию | `--notification-close-display: none` → `inline-flex` чтобы показать |

Позиция на home: **16px справа**, **16px ниже аватара** (`--notification-inset-*`).

Motion: выезд справа налево → hold (`--motion-notification-hold`) → уезд вправо. Close / повторный `show` сбрасывают таймер.

## API

```js
import { createNotification } from "../notification/Notification.js";

const toast = createNotification();
document.querySelector(".home-screen").append(toast.root);

toast.show("У тебя не хватает уток");
await toast.hide();
```

### Возвращает

| Метод / поле | Назначение |
|--------------|------------|
| `root` | контейнер (absolute top-right) |
| `show(message)` | текст + open + auto-hide |
| `hide()` | `Promise` после slide-out |
| `isVisible()` | открыт и не в closing |
| `setCloseAriaLabel` | aria кнопки close |

## Кейсы на home

1. Нет уток при «Закинуть» → `homeNotifyNoDucks` (+ buzz submit / чип баланса).
2. Слот занят → `homeNotifySlotTaken` (+ flash submit). Deep link `/portfolio` при занятом слоте — тот же toast через `homeScreen.showNotification`.

## Код

| Файл | Роль |
|------|------|
| [`Notification.js`](Notification.js) | фабрика `createNotification` |
| [`styles/notification.css`](../../../styles/notification.css) | layout + slide |
| [`styles/tokens.css`](../../../styles/tokens.css) | `--notification-*` / `--motion-notification-*` |
| [`src/assets/home/notification-error.svg`](../../assets/home/notification-error.svg) | иконка `!` в круге |
| `content/locales.json` | `homeNotify*`, `notificationCloseAria` |

Подключение CSS: `index.html` → после `feedback.css`.
