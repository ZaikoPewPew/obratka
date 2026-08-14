# `feedback` — фидбек (Telegram)

Fixed-кнопка 56×56 в правом нижнем углу home → `COMMUNITY_CONTACT_URL` (`https://t.me/ezzzz12345`).

## Поведение

- `position: absolute` внутри `home-screen` (экран сам `fixed`) — остаётся на месте при скролле ленты.
- Отступы: `--feedback-offset` = 16px справа и снизу.
- Квадрат 56 (`--feedback-size`), radius 16 (`--feedback-radius`), фон `--feedback-bg` (gray-900).
- Два белых эллипса 9×10 (`--feedback-eye-*`): покой — 16px от верхнего края, зазор 8px (схождение не ближе 4px — только если курсор **над самой кнопкой** и между глазами, не на профиле / ленте); следят за курсором по всей площади куба (включая низ); не выходят за pad 8px. Без курсора — idle-взгляд по сторонам (`idleLookShift`). Уход мыши со страницы — плавный возврат в покой, затем снова idle. Морг — `motion-feedback-blink` (живой ритм 3.2–6.2 с, иногда двойной). `prefers-reduced-motion` — покой, без слежения / idle / морга. Фон без hover-заливки.
- Тултип `homeFeedbackTooltip` («Нужна помощь?») на hover / focus-visible.
- Не прячется вместе с tabbar-dock.
- На `home-screen--open` — entrance `motion-reveal-topbar` с delay `--home-screen-reveal-delay-fab`.
- Lottie-кепка (`cap-lottie.json`) пока не используется.

## API

`createFeedback({ href? })` → `{ root, syncCopy }`.

## Код

- JS: [`Feedback.js`](./Feedback.js)
- CSS: [`styles/feedback.css`](../../../styles/feedback.css)
- Токены: `--feedback-*`, `--motion-feedback-*` в [`styles/tokens.css`](../../../styles/tokens.css)
- Позиции глаз: [`src/utils/feedbackEyes.js`](../../utils/feedbackEyes.js)
- URL: [`src/config/contacts.js`](../../config/contacts.js)
