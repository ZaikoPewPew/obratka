# `home-screen` — главная (лента)

Path: **`/home`**. После onboarding: шапка (лого, баланс, уведомления, аватар) + лента карточек портфолио.

## Поведение

Очередь: mock seed (`Наринэ`, `Janelle`) + поданные URL из localStorage (`obratka.submittedPortfolios`).  
Клик по карточке → `onOpenPortfolio` → `/review`.  
CTA «Закинуть своё» — в топбаре слева от баланса (нужен баланс ≥ `SUBMIT_COST`).

Лента ровно по центру экрана (отступ сверху `--home-screen-body-padding-top` = 16px от края экрана);
topbar поверх контента (`position: absolute`), не сдвигает ленту вниз; появление без `filter` (`motion-reveal-topbar`), иначе белый композитный слой.

На десктопе (≥960px) слева от ленты sticky-aside (прилегает с `--home-screen-aside-gap`).

### Профиль и баланс

- Есть `session.avatarUrl` → фото; нет / ошибка загрузки → фон + буква из имени (`displayName` / telegram / email).
- При `open` / `refresh` профиль синкается из Supabase (`refreshSessionFromProfile` через `refreshWalletFromServer`).
- Баланс: `profiles.balance` ↔ `session.balance`.

### Dev-кнопки (под лентой)

| Кнопка | Действие |
|--------|----------|
| `+{amount} монет` | `creditBalance` (локально + Supabase) |
| `Сбросить сессию` | `signOut()` → `clearSession` + clear portfolios → `go("referral")` |

## Поля карточки

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
Ключи: `homeTitle`, `homeListAria`, `homeEmpty`, `homeAddPortfolio`, `homeBalanceAria`, `homeNotificationsAria`, `homeProfileAria`, `homeCardProgress`, `homeDefaultRole`, `homePlatformWebLetter`, `homeSubmitLocked`, `homeSubmitCost`, `homeAddCoins*`, `homeResetSession*`.

См. [`SCREENS.md`](../../../SCREENS.md).
