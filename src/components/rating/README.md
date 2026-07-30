# `rating` — оболочка aside (не в entry)

Папка `src/components/rating/` — **неиспользуемый** sticky aside под левую колонку home. В продукте вкладка «Рейтинг» уже живёт **внутри** [`home-screen`](../home-screen/README.md): карточки `.home-screen__rating-list` + API [`listRatingTop`](../../api/rating.js) (топ-50 по репутации) / SQL `rating_leaderboard.sql`.

Левый sticky aside на desktop раньше занимал [`legendary-online-panel`](../legendary-online-panel/) (теперь fixed-чип слева снизу); этот модуль рейтинга **не** монтируется.

Файл: [`RatingPanel.js`](./RatingPanel.js). Стили: [`styles/rating-panel.css`](../../../styles/rating-panel.css) (**не** подключены в `index.html`). Токены aside: `--home-screen-aside-*` в [`styles/tokens.css`](../../../styles/tokens.css).

## API

`createRatingPanel()` → `{ root }`

`root` — `aside.rating-panel` с поверхностью `.rating-panel__surface`. Сейчас `hidden` + `aria-hidden`.

## Если когда-нибудь включать aside

1. Подключить `styles/rating-panel.css`.
2. Не путать с вкладкой `?tab=rating` — она уже wired без этого компонента. Левая колонка aside больше не занята (legendary — fixed-чип).
