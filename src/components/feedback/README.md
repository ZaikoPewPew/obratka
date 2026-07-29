# `feedback` — фидбек (Telegram)

Fixed-кнопка 56×56 в правом нижнем углу home: bubble-иконка на тёмном фоне → `COMMUNITY_CONTACT_URL` (`https://t.me/ezzzz12345`).

## Поведение

- `position: absolute` внутри `home-screen` (экран сам `fixed`) — остаётся на месте при скролле ленты.
- Отступы: `--feedback-offset` = 16px справа и снизу.
- Padding: 12×16 (`--feedback-padding-*`), radius 16 (`--radius-md`).
- Тултип `homeFeedbackTooltip` («Для быстрой связи») на hover / focus-visible.
- Не прячется вместе с tabbar-dock.
- На `home-screen--open` — entrance `motion-reveal-topbar` с delay `--home-screen-reveal-delay-fab`.

## API

`createFeedback({ href? })` → `{ root, syncCopy }`.

## Код

- JS: [`Feedback.js`](./Feedback.js)
- CSS: [`styles/feedback.css`](../../../styles/feedback.css)
- Токены: `--feedback-*` в [`styles/tokens.css`](../../../styles/tokens.css)
- Иконка: [`src/assets/home/feedback.svg`](../../assets/home/feedback.svg)
- URL: [`src/config/contacts.js`](../../config/contacts.js)
