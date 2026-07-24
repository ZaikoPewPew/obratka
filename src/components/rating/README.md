# `rating` — рейтинг на главной

Топ пользователей по кол-ву игровой валюты (активные). Пока **не монтируется** на `home-screen` — только оболочка под будущий контент.

Файл: [`RatingPanel.js`](./RatingPanel.js). Стили: [`styles/rating-panel.css`](../../../styles/rating-panel.css) (подключить в `index.html`, когда включим). Токены: `--home-screen-aside-*` в [`styles/tokens.css`](../../../styles/tokens.css) — переименуем/перенесём при включении.

## API

`createRatingPanel()` → `{ root }`

`root` — `aside.rating-panel` с поверхностью `.rating-panel__surface`. Сейчас `hidden` + `aria-hidden`.

## Включение на home

1. Подключить `styles/rating-panel.css`.
2. В `HomeScreen` смонтировать `createRatingPanel().root` слева от ленты в `home-screen__cluster`.
3. Вернуть desktop-лейаут: sticky aside слева от центрированной ленты (см. историю `home-screen.css`).
