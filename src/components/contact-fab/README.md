# `contact-fab` — быстрая связь (Telegram)

Fixed-кнопка 56×56 (Figma `478:1814`) в правом нижнем углу home: иконка Telegram на тёмном фоне → `COMMUNITY_CONTACT_URL`.

## Поведение

- `position: absolute` внутри `home-screen` (экран сам `fixed`) — остаётся на месте при скролле ленты.
- Отступы: `--contact-fab-offset` = 16px справа и снизу.
- Тултип `homeContactFabTooltip` («Для быстрой связи») на hover / focus-visible.
- Не прячется вместе с tabbar-dock.

## API

`createContactFab({ href? })` → `{ root, syncCopy }`.

## Код

- JS: [`ContactFab.js`](./ContactFab.js)
- CSS: [`styles/contact-fab.css`](../../../styles/contact-fab.css)
- Токены: `--contact-fab-*` в [`styles/tokens.css`](../../../styles/tokens.css)
- Иконка: [`src/assets/home/telegram.svg`](../../assets/home/telegram.svg)
- URL: [`src/config/contacts.js`](../../config/contacts.js)
