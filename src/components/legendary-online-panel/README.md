# `legendary-online-panel` — «p4p в сети»

Fixed-чип слева снизу на `/home` (Figma `489:3318`). Показывает аватары пользователей с `tier = legendary`, у которых свежий `last_seen_at` (RPC `list_online_legendaries`). Офлайн и пустой список — блок скрыт целиком. Клик → explainer `homeLegendaryOnline*` (Figma `492:4009`): фото [`currency-p2p.png`](../../assets/home/modal/currency-p2p.png) + Lottie `rotating-ray` (552×268, без подложки), secondary «Ясн».

Файл: [`LegendaryOnlinePanel.js`](./LegendaryOnlinePanel.js). Стили: [`styles/legendary-online-panel.css`](../../../styles/legendary-online-panel.css). Токены: `--legendary-online-*` в [`styles/tokens.css`](../../../styles/tokens.css).

## API

`createLegendaryOnlinePanel({ onOpen? })` → `{ root, setItems, syncCopy }`

- `setItems(items)` — `{ id, displayName?, avatarUrl? }[]` (только online; пустой → `hidden`)
- `syncCopy()` — i18n (`homeLegendaryOnline*`)
- `onOpen` — клик / Enter / Space по чипу (модалка монтируется в home)

Монтаж: [`HomeScreen.js`](../home-screen/HomeScreen.js) на root рядом с `feedback` (`left/bottom: 16px`). Poll вместе с home (`HOME_SLOTS_POLL_MS` = 45 с). Heartbeat пишет только legendary-клиент (`main.js` + `heartbeat_legendary_presence`).

При переходе 0 → N — класс `--enter` + `motion-reveal` (въезд снизу). До 3 аватаров в чипе; точка онлайна сверху справа на каждом. Hover по аватару — тултип с ФИО (`displayName`, `legendary-online-panel__tip`).

Рейтинг валюты на вкладке `?tab=rating` — внутри [`home-screen`](../home-screen/README.md) (`listRatingTop`). Папка [`rating/`](../rating/) — неиспользуемый aside, не путать.
