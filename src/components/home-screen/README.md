# `home-screen` — главная (лента + мои)

Path: **`/home`**. После onboarding: шапка (лого, баланс, уведомления, аватар) + лента карточек портфолио + нижний переключатель **На ревью / Мои посты**.

Файл: [`HomeScreen.js`](./HomeScreen.js). Стили: [`styles/home-screen.css`](../../../styles/home-screen.css). Токены: `--home-screen-*` в [`styles/tokens.css`](../../../styles/tokens.css).

## Поведение

### Вкладки

| Вкладка | API | Содержимое |
|---------|-----|------------|
| **На ревью** (`feed`, default) | `listPortfoliosForReview()` | Чужие `pending` **в лиге** грейда ревьюера (RLS), без своих; уже отревьюенные этим юзером скрыты |
| **Мои посты** (`mine`) | `listMyPortfolios()` | Все портфолио текущего пользователя (pending / done / …) |

Переключатель: `home-screen__tabbar` — fixed-слой на `home-screen`, **по центру экрана**, `bottom: 16px` (`--home-screen-tabbar-offset` = `--space-4`). Вкладки: **На ревью** / **Мои посты**.

- Скролл **вниз** по `home-screen__body` → таббар уезжает за нижний край (`--hidden`).
- Скролл **вверх** (любой delta &lt; 0) / у верхнего края → снова виден сразу.
- Hide — с небольшим порогом (`TABBAR_HIDE_DELTA`), чтобы трекпад не дёргал.
- Анимация hide/show: `--home-screen-tabbar-hide-duration` / `--home-screen-tabbar-hide-ease` → `--motion-screen-*`.

### Контраст над тёмным превью

Пока таббар виден, сэмплим яркость фона под ним (`src/utils/backdropLuminance.js`, scroll / resize / load превью). Если фон тёмный → класс `home-screen__tabbar--on-dark`: светлая подложка; цвет текста табов как обычно (тёмный неактивный / светлый на активном пилле). Токен: `--home-screen-tabbar-track-bg-on-dark`, transition `--home-screen-tabbar-contrast-*`.

### Переключение таба (UI)

Активный фон — отдельный слой `home-screen__tabbar-thumb` (скользящий пилл):

- при смене вкладки двигается `transform` + `width` к активной кнопке;
- длительность/easing: `--home-screen-tabbar-thumb-*` → `--motion-screen-*`;
- цвет подписи таба плавно через `transition: color` (`--home-screen-tabbar-label-*`);
- радиусы: обёртка **16px** (`--radius-md`), табы **12px**; padding трека **4px**, blur **20px**.

Синхрон позиции thumb: после `open` / смены таба / `syncCopy` (смена языка меняет ширину) / `ResizeObserver` / `window.resize`.

### Лента и карточки

При `open` / смене таба: skeleton только у ленты (5 целых карточек-шиммеров), хедер без изменений; затем данные с `motion-reveal` stagger.  
Клик по чужой карточке → `claimPortfolioReview` → `onOpenPortfolio` → `/review`.  
Своя (`isOwn`, вкладка «Мои») → `onOpenReport` → `/report` (каркас отчёта).  
CTA «Закинуть своё» — всегда активна (чёрная). Баланс ≥ `SUBMIT_COST` → `onAddPortfolio` → `/portfolio`; иначе stub-модалка «не хватает монет» (контент позже).

Лиги (тихий матчинг): junior → junior; middle → junior+middle; senior/lead/head → middle+senior+.  
Клиент-зеркало: [`src/api/leagues.js`](../../api/leagues.js). Сервер: [`supabase/sql/portfolios.sql`](../../../supabase/sql/portfolios.sql) + [`review_claims.sql`](../../../supabase/sql/review_claims.sql) (`can_review_portfolio`, claim-слоты, RLS).

Лента по центру экрана (`--home-screen-body-padding-top` = 16px сверху); снизу запас под таббар (`--home-screen-body-padding-bottom`).  
Topbar поверх контента (`position: absolute`), появление без `filter` (`motion-reveal-topbar`).

Рейтинг слева (топ по валюте) — компонент [`rating/`](../rating/), пока **не монтируется**.

### Профиль и баланс

- Есть `session.avatarUrl` → только фото (круг), буква скрыта; нет URL / ошибка загрузки → тёмный круг + буква имени (картинка скрыта).
- Логотип в шапке — blob-марка (`mark.svg` / `brandMarkSvg`), как на gradient-экранах.
- Empty state ленты — карточка `--home-screen-empty-*` (радиус 24, высота 326, muted-фон, текст по центру).
- Если в `profiles.avatar_url` пусто — при refresh подтягиваем picture из Auth и пишем в профиль.
- При `open` / `refresh` — `refreshWalletFromServer` → `refreshSessionFromProfile`.
- Баланс: `profiles.balance` ↔ `session.balance`.
- Клик по чипу баланса (dev): `creditBalance(+10)`.

### Dev: сброс сессии

Временно: клик по логотипу в шапке → `onResetSession` → signOut / clear / `go("referral")`.

## Поля карточки

| Элемент | Источник |
|---------|----------|
| Превью | thum.io / fallback |
| Иконка площадки | Simple Icons; иначе литера **W** |
| Аватар | `item.avatarUrl` или буква из `item.name` |
| ФИО | `item.name` |
| Роль | EN Title Case: `formatPortfolioRole` |
| Счётчик | `{current} из {total}` = `reviewsCount` / `targetReviews` (только completed) |
| Слоты ревьюеров | `.home-screen__reviewer-slots` — completed + active claims (аватарки); RPC `portfolio_reviewer_slots`, fallback через RLS |

`refresh()` при `open`, смене вкладки и `visibilitychange` (вкладка снова видима).
| Своя | `isOwn` только во вкладке «Мои» → клик открывает report |

## Разметка таббара

```
.home-screen__tabbar          role=tablist
  .home-screen__tabbar-thumb  aria-hidden (пилл)
  button.home-screen__tab     role=tab  data-tab=feed|mine
```

Классы состояния: `--active` на табе; `--hidden` на tabbar при скролле вниз; `--on-dark` при тёмном фоне под баром.

## API модуля

`createHomeScreen({ onOpenPortfolio, onAddPortfolio?, onResetSession? })` → `{ root, open, close, setItems, refresh }`.

Внутреннее: `activeTab` `feed` \| `mine`; `refresh` читает соответствующий list API.

## Стили / i18n / a11y

Токены `--home-screen-tabbar-*` (высота 56, padding трека 4px, таб 48, offset 16, радиус 16/12, blur 20, motion hide/thumb/label/contrast, on-dark track).

Ключи: `homeTitle`, `homeListAria`, `homeListLoadingAria`, `homeListMineAria`, `homeEmpty`, `homeEmptyMine`, `homeTabFeed`, `homeTabMine`, `homeTabsAria`, `homeAddPortfolio`, `homeBalanceAria`, `homeNotificationsAria`, `homeProfileAria`, `homeCardProgress`, `homeCardOwnTitle`, `homeCardOwnAria`, `homeDefaultRole`, `homePlatformWebLetter`, `homeSubmitLocked`, `homeSubmitLockedTitle`, `homeSubmitLockedClose`, `homeSubmitLockedCloseAria`, `homeSubmitCost`, `homeResetSessionTitle`.

`prefers-reduced-motion: reduce` — hide/thumb/label transitions ≈ мгновенные.

См. [`SCREENS.md`](../../../SCREENS.md), [`src/api/README.md`](../../api/README.md).
