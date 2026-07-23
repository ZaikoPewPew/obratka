# `home-screen` — главная (лента)

Path: **`/home`**. После onboarding: шапка (лого, баланс, уведомления, аватар) + лента карточек портфолио.

## Поведение

Очередь: mock seed (`Наринэ`, `Janelle`) + поданные URL из localStorage (`obratka.submittedPortfolios`).  
Клик по карточке → `onOpenPortfolio` → `/review`.  
CTA «Закинуть своё» — в топбаре слева от баланса. Dev-кнопки — под лентой (`Сбросить сессию` → `signOut` + clear local session).  
Лента ровно по центру экрана; на десктопе слева от неё sticky-панель (прилегает с `--home-screen-aside-gap`).
Topbar прозрачный; появление без `filter` (иначе белый слой).

Профиль в шапке: есть `avatarUrl` → фото; нет / ошибка → фон + буква из имени.
При open/refresh профиль синкается из Supabase (`refreshSessionFromProfile` через wallet refresh).

### Поля карточки

| Элемент | Источник |
|---------|----------|
| Превью | thum.io / fallback |
| Иконка площадки | Simple Icons для известных сервисов; иначе литера **W** (кастомный сайт) |
| Аватар | `item.avatarUrl` (фото Google/Telegram) или буква из `item.name` |
| ФИО | `item.name` ← `session.displayName` (для своих) / seed |
| Роль | всегда EN Title Case: `Senior Product Designer` (`formatPortfolioRole`) |
| Счётчик | `{current} из {total}` (`previewCount`) |

## API

`createHomeScreen({ onOpenPortfolio, onAddPortfolio?, onResetSession? })` → `{ root, open, close, setItems, refresh }`.

## Стили / i18n

`styles/home-screen.css`, токены `--home-screen-*`.  
Ключи: `homeTitle`, `homeListAria`, `homeEmpty`, `homeAddPortfolio`, `homeBalanceAria`, `homeNotificationsAria`, `homeProfileAria`, `homeCardProgress`, `homeDefaultRole`, `homePlatformWebLetter`, `homeSubmitLocked`, `homeSubmitCost`.

См. [`SCREENS.md`](../../../SCREENS.md).
