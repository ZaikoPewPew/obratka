# `legendary-online-panel` — легенды онлайн (aside на home)

Левый sticky aside на `/home` (desktop ≥960px). Показывает пользователей с `tier = legendary`, у которых свежий `last_seen_at` (RPC `list_online_legendaries`).

Файл: [`LegendaryOnlinePanel.js`](./LegendaryOnlinePanel.js). Стили: [`styles/legendary-online-panel.css`](../../../styles/legendary-online-panel.css). Токены: `--home-screen-aside-*` / `--legendary-online-*` в [`styles/tokens.css`](../../../styles/tokens.css).

## API

`createLegendaryOnlinePanel()` → `{ root, setItems, syncCopy }`

- `setItems(items)` — `{ id, displayName?, avatarUrl? }[]`
- `syncCopy()` — i18n (`homeLegendaryOnline*`)

Монтаж: [`HomeScreen.js`](../home-screen/HomeScreen.js) слева в `home-screen__cluster`. Poll вместе с home (~15 с). Heartbeat пишет только legendary-клиент (`main.js` + `heartbeat_legendary_presence`).

Рейтинг валюты на вкладке `?tab=rating` — внутри [`home-screen`](../home-screen/README.md) (`listRatingTop`). Папка [`rating/`](../rating/) — неиспользуемый aside, не путать.
