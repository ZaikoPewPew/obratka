# `home-screen` — главная (лента)

Path: **`/home`**. После onboarding: шапка (лого, баланс, уведомления, аватар) + лента карточек портфолио.

## Поведение

Очередь: mock seed (`Наринэ`, `Janelle`) + поданные URL из localStorage (`obratka.submittedPortfolios`).  
Карточка: превью (thum.io / fallback), favicon платформы + аватар, имя, роль, счётчик «N из M».  
Профиль в шапке: `session.avatarUrl` (Telegram `photo_url`), иначе unavatar по email.  
Клик по карточке → `onOpenPortfolio` → `/review`.  
CTA «Подать своё» и dev-кнопки — под лентой. На десктопе справа пустая панель (как в Figma).

## API

`createHomeScreen({ onOpenPortfolio, onAddPortfolio?, onResetSession? })` → `{ root, open, close, setItems, refresh }`.

## Стили / i18n

`styles/home-screen.css`, токены `--home-screen-*`.  
Ключи: `homeTitle`, `homeListAria`, `homeEmpty`, `homeAddPortfolio`, `homeBalanceAria`, `homeNotificationsAria`, `homeProfileAria`, `homeCardProgress`, `homeDefaultRole`, `homeSubmitLocked`, `homeSubmitCost`.

См. [`SCREENS.md`](../../../SCREENS.md).
