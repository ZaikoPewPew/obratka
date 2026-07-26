# `rating` — оболочка aside (не в entry)

Папка `src/components/rating/` — **неиспользуемый** sticky aside под левую колонку home. В продукте вкладка «Рейтинг» уже живёт **внутри** [`home-screen`](../home-screen/README.md): карточки `.home-screen__rating-list` + API [`listRatingTop`](../../api/rating.js) / SQL `rating_leaderboard.sql`.

Левый sticky aside на desktop сейчас — [`legendary-online-panel`](../legendary-online-panel/), не этот модуль.

Файл: [`RatingPanel.js`](./RatingPanel.js). Стили: [`styles/rating-panel.css`](../../../styles/rating-panel.css) (**не** подключены в `index.html`). Токены aside: `--home-screen-aside-*` в [`styles/tokens.css`](../../../styles/tokens.css).

## API

`createRatingPanel()` → `{ root }`

`root` — `aside.rating-panel` с поверхностью `.rating-panel__surface`. Сейчас `hidden` + `aria-hidden`.

## Если когда-нибудь включать aside

1. Подключить `styles/rating-panel.css`.
2. Решить конфликт с `legendary-online-panel` (одна левая колонка).
3. Не путать с вкладкой `?tab=rating` — она уже wired без этого компонента.
