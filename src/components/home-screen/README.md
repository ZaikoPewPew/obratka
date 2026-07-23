# `home-screen` — главная (лента)

Path: **`/home`**. После onboarding: шапка (лого, баланс, уведомления, аватар) + лента карточек портфолио.

## Поведение

Очередь: mock seed (`Наринэ`, `Janelle`) + поданные URL из localStorage (`obratka.submittedPortfolios`).  
Клик по карточке → `onOpenPortfolio` → `/review`.  
CTA «Подать своё» и dev-кнопки — под лентой. На десктопе справа пустая панель (как в Figma).

Профиль в шапке: `session.avatarUrl` (Telegram `photo_url`), иначе unavatar по email.

### Поля карточки

| Элемент | Источник |
|---------|----------|
| Превью | thum.io / fallback |
| Иконка площадки | [Simple Icons](https://github.com/simple-icons/simple-icons) для известных сервисов (Behance, Framer, Notion…); иначе favicon сайта (Google → DDG). Личные домены и `*.github.io` — всегда favicon |
| Аватар | `item.avatarUrl` ← Telegram `photo_url` (другие провайдеры позже) |
| ФИО | `item.name` ← `session.displayName` (Telegram) |
| Роль | `item.role` ← грейд + специализация онбординга (`formatPortfolioRole`) |
| Счётчик | `{current} из {total}` — сколько уже проревьюили / сколько нужно (`previewCount`) |

При `submitPortfolio` имя, аватар и роль подтягиваются из текущей сессии.

## API

`createHomeScreen({ onOpenPortfolio, onAddPortfolio?, onResetSession? })` → `{ root, open, close, setItems, refresh }`.

## Стили / i18n

`styles/home-screen.css`, токены `--home-screen-*`.  
Ключи: `homeTitle`, `homeListAria`, `homeEmpty`, `homeAddPortfolio`, `homeBalanceAria`, `homeNotificationsAria`, `homeProfileAria`, `homeCardProgress`, `homeDefaultRole`, `homeSubmitLocked`, `homeSubmitCost`.

См. [`SCREENS.md`](../../../SCREENS.md).
