# `home-screen` — главная (лента)

Path: **`/home`**. После onboarding: шапка (лого, баланс, уведомления, аватар) + лента карточек портфолио.

## Поведение

Очередь: mock seed (`Наринэ`, `Janelle`) + поданные URL из localStorage (`obratka.submittedPortfolios`).  
Клик по карточке → `onOpenPortfolio` → `/review`.  
CTA «Закинуть своё» — в топбаре слева от баланса. Dev-кнопки — под лентой.  
Лента по центру экрана; на десктопе справа sticky-панель.

Профиль в шапке: `session.avatarUrl` (Telegram `photo_url`), иначе unavatar по email.  
Баланс: `profiles.balance` из Supabase → сессия (`refreshWalletFromServer` при open/refresh).

### Поля карточки

| Элемент | Источник |
|---------|----------|
| Превью | thum.io / fallback |
| Иконка площадки | Simple Icons для известных сервисов; иначе favicon сайта. Личные домены и `*.github.io` — favicon |
| Аватар | `item.avatarUrl` ← Telegram `photo_url` |
| ФИО | `item.name` ← `session.displayName` |
| Роль | всегда EN Title Case: `Senior Product Designer` (`formatPortfolioRole`) |
| Счётчик | `{current} из {total}` (`previewCount`) |

## API

`createHomeScreen({ onOpenPortfolio, onAddPortfolio?, onResetSession? })` → `{ root, open, close, setItems, refresh }`.

## Стили / i18n

`styles/home-screen.css`, токены `--home-screen-*`.  
Ключи: `homeTitle`, `homeListAria`, `homeEmpty`, `homeAddPortfolio`, `homeBalanceAria`, `homeNotificationsAria`, `homeProfileAria`, `homeCardProgress`, `homeDefaultRole`, `homeSubmitLocked`, `homeSubmitCost`.

См. [`SCREENS.md`](../../../SCREENS.md).
