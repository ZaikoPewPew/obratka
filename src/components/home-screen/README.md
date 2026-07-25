# `home-screen` — главная (лента + мои)

Path: **`/home`**. После onboarding: шапка (лого, баланс, уведомления, аватар) + лента карточек портфолио + нижний переключатель **На ревью / Мои посты**.

Файл: [`HomeScreen.js`](./HomeScreen.js). Стили: [`styles/home-screen.css`](../../../styles/home-screen.css). Токены: `--home-screen-*` в [`styles/tokens.css`](../../../styles/tokens.css).

## Поведение

### Вкладки

| Вкладка | API | Содержимое |
|---------|-----|------------|
| **На ревью** (`feed`, default) | `listPortfoliosForReview()` | Чужие `pending` **в лиге** грейда ревьюера (RLS), без своих; карточка до `target_reviews` completed-отчётов; уже отревьюенные этим юзером помечены `reviewedByMe` (клик → notice) |
| **Мои посты** (`mine`) | `listMyPortfolios()` | Все портфолио текущего пользователя (pending / done / …) |

Переключатель: `home-screen__tabbar` — fixed-слой на `home-screen`, **по центру экрана**, `bottom: 16px` (`--home-screen-tabbar-offset` = `--space-4`). Вкладки: **На ревью** / **Мои посты**.

- Скролл **вниз** по `home-screen__body` → таббар уезжает за нижний край (`--hidden`).
- Скролл **вверх** (любой delta &lt; 0) / у верхнего края → снова виден сразу.
- Hide — с небольшим порогом (`TABBAR_HIDE_DELTA`), чтобы трекпад не дёргал.
- Анимация hide/show: `--home-screen-tabbar-hide-duration` / `--home-screen-tabbar-hide-ease` → `--motion-screen-*`.

### Контраст над тёмным превью

Пока таббар виден, сэмплим яркость фона под ним (`src/utils/backdropLuminance.js`, scroll / resize / load превью). Треки полупрозрачные + blur 20: на светлом — gray-900 20% (`--home-screen-tabbar-track-bg`), неактивный текст `--color-text`; на тёмном → `--on-dark` — white 20% (`--home-screen-tabbar-track-bg-on-dark`), неактивный текст `--home-screen-tabbar-tab-color-on-dark`. Transition `--home-screen-tabbar-contrast-*`.

### Переключение таба (UI)

Активный фон — отдельный слой `home-screen__tabbar-thumb` (скользящий пилл):

- при смене вкладки двигается `transform` + `width` к активной кнопке;
- длительность/easing: `--home-screen-tabbar-thumb-*` → `--motion-screen-*`;
- цвет подписи таба плавно через `transition: color` (`--home-screen-tabbar-label-*`);
- радиусы: обёртка **16px** (`--radius-md`), табы **12px**; padding трека **4px**, blur **20px**.

Синхрон позиции thumb: после `open` / смены таба / `syncCopy` (смена языка меняет ширину) / `ResizeObserver` / `window.resize`.

### Порядок ленты «На ревью»

Цель: ревьюер чаще открывает то, что **быстрее даёт completed и закрывает слот автора** (дойти до `target_reviews`, default 3). Не newest-first.

Сорт — **клиентский**, в [`src/api/portfolios.js`](../../api/portfolios.js) (`sortFeedForSlotClosure`), **после** `attachReviewerSlots` (нужны live claims). Home / кэш порядок не меняют — сохраняют то, что вернул API. Вкладка **Мои** — без этого сорта: `created_at` DESC.

Конвейер:

```
list pending (RLS лига) → reviewedByMe → attachReviewerSlots → sortFeedForSlotClosure → setItems / cache
```

Ключи (по убыванию приоритета; стабильный sort, вход не мутируется):

| # | Ключ | Выше | Ниже |
|---|------|------|------|
| 1 | `reviewedByMe` | ещё не ревьюил | уже ревьюил (клик → notice, не claim) |
| 2 | свободный слот | `openSlots > 0` | `openSlots ≤ 0` (claim даст `no_slots`) |
| 3 | remaining | меньше осталось (`2/3` → `1/3` → `0/3`) | свежие без прогресса |
| 4 | `createdAt` | старше (FIFO) | новее |

Формулы (как claim-квота: completed + live claims):

- `activeCount` = число `reviewerSlots` с `kind === "active"`
- `openSlots = targetReviews − reviewsCount − activeCount`
- `remaining = max(0, targetReviews − reviewsCount)`

`createdAt` мапится из `portfolios.created_at` в `PortfolioQueueItem` (нужен только tie-break; в UI не показывается).

**Почему не SQL `ORDER BY`:** live claims приходят вторым RPC (`portfolio_reviewer_slots`); сервер без join не знает «занято claim’ом». PostgREST `.order("created_at")` — только грубый pre-order; финальный порядок после `sortFeedForSlotClosure`.

**Что не меняем этим сортом:** видимость карточек (full / `reviewedByMe` остаются в ленте), claim TTL, лиги, `target_reviews`. Весов / explainer порядка в UI нет.

### Лента и карточки

SWR: при `open` / смене таба / F5 — если есть кэш вкладки (`feed` / `mine`, memory + `sessionStorage` по `userId`), карточки сразу; иначе skeleton (cold miss). Затем тихий `refresh()` поверх кэша. Пустой `[]` — валидный hit. Кэш сбрасывается на logout (`clearHomeListCache`). Порядок feed в кэше = уже отсортированный ответ `listPortfoliosForReview`.

После skeleton данные с `motion-reveal` stagger; после тихого refetch при тех же id — только патч reviewer-слотов (без пересборки DOM / thum.io); новые карточки — full rebuild + reveal только для новых id.

Клик по чужой карточке → intro-модалка «Как проходит ревью» (`createAppModal`, шаги `homeReviewIntroStep1…4`, таймер из [`src/config/review.js`](../../config/review.js)) → CTA «Проревьюить» → `onOpenPortfolio` → `claimPortfolioReview` → `/review` (таймер + опц. надиктовка). «Не сейчас» / закрытие — без claim.  
Своя (`isOwn`, вкладка «Мои») кликабельна всегда: собраны все ревью (`reviewsCount >= targetReviews`) → `onOpenReport` → `/report` (листы + жалоба); иначе модалка `homeMineNotReady*` с прогрессом. Title / aria карточки — `homeCardReport*` либо `homeCardReportPending*`, пересинхронизируются при silent-патче слотов.  
Уже отревьюенная карточка (`reviewedByMe`) intro не показывает — сразу notice из `main.js`.
CTA «Закинуть своё» — всегда активна (чёрная). Баланс ≥ `SUBMIT_COST` → `onAddPortfolio` → `/portfolio`; иначе `createAppModal` «не хватает монет».

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
- Репутация: `profiles.reputation` ↔ `session.reputation`; чип = иконка + дельта от 100 (`0` / `+10` / `-20`, `formatReputationDelta`); клик → explainer через `createAppModal` (без весов тегов).
- Порядок чипов: «Закинуть своё» → репутация → баланс → уведомления → аватар.
- Баланс: `profiles.balance` ↔ `session.balance`.
- Клик по чипу баланса (**временно**): `TEMP_BALANCE_CHIP_CREDIT` → RPC `temp_credit_balance` (+10); иначе DEV local-only. Убрать флаг + RPC после тестов. Серверный spend — `spend_submit_cost`.
- CTA «Закинуть своё» без монет → `createAppModal` «Монет маловато»; notices (no slots / already reviewed) — тот же `noticeModal`.
- Клик по аватару профиля → `account-menu` из Figma `467:1320`, раскрывающийся влево от правого края аватара с отступом 16px вниз (без выхода за viewport).
- В меню `displayName` (из `profiles.display_name`) и email не кликабельны; «Настройки» → `/settings`, «Пригласить» → `homeInvite*`-модалка, «Контакты» → `createAppModal`, «Выйти» → полный Supabase `signOut` + очистка локальной сессии.

Логотип в шапке декоративный и не сбрасывает сессию.

## Поля карточки

| Элемент | Источник |
|---------|----------|
| Превью | thum.io; до load — skeleton (`--loading`), при error — `--empty` |
| Иконка площадки | Simple Icons; иначе литера **W** |
| Аватар | `item.avatarUrl` или буква из `item.name` |
| ФИО | `item.name` |
| Роль | EN Title Case: `formatPortfolioRole` (Lead → `… Design Lead`, Head → `Head Of …`) |
| Слоты | Белый чип `.home-screen__card-progress` 96×52 r16 (Figma Frame 140); внутри стек 64×24 |
| Пустой слот | 24×24, фон muted, **внешняя** обводка 3px (box-shadow), плюс 18×18 |
| Active / completed | Аватарка; margin −4px между слотами, L→R |

Заполнение слотов слева направо; по умолчанию три плюса. Текста «N из 3» нет (есть в aria).

`refresh()` при `open`, смене вкладки, `visibilitychange` и poll (~15с), пока home открыт — слоты и новые карточки подтягиваются без skeleton (поверх кэша). Своя карточка (`isOwn`, «Мои») всегда кликабельна (`cursor: pointer`, класс `--own`): готово (`reviewsCount >= targetReviews`) → `onOpenReport` → `/report`; иначе `homeMineNotReady*` (не «сразу report»). Title / aria — `homeCardReport*` / `homeCardReportPending*`, синк при silent-патче.

Own-карточки: cursor наследуется от `.home-screen__card` (pointer); `not-allowed` только у `:disabled` — правило `.home-screen__card--own { cursor: not-allowed }` снято.

## Разметка таббара

```
.home-screen__tabbar          role=tablist
  .home-screen__tabbar-thumb  aria-hidden (пилл)
  button.home-screen__tab     role=tab  data-tab=feed|mine
```

Классы состояния: `--active` на табе; `--hidden` на tabbar при скролле вниз; `--on-dark` при тёмном фоне под баром.

## API модуля

`createHomeScreen({ onOpenPortfolio, onOpenReport?, onAddPortfolio?, onOpenSettings?, onSignOut? })` → `{ root, open, close, setItems, refresh, showNotice }`.

Внутреннее: `activeTab` `feed` \| `mine`; `refresh` читает соответствующий list API; кэш вкладок — [`homeListCache.js`](../../utils/homeListCache.js).

## Стили / i18n / a11y

Токены `--home-screen-tabbar-*` (высота 56, padding трека 4px, таб 48, offset 16, радиус 16/12, blur 20, translucent track / on-dark track+label, motion hide/thumb/label/contrast).

Токены intro-модалки: `--home-screen-review-intro-indent` / `--home-screen-review-intro-step-gap`.

Ключи: `homeTitle`, `homeListAria`, `homeListLoadingAria`, `homeListMineAria`, `homeEmpty`, `homeEmptyMine`, `homeTabFeed`, `homeTabMine`, `homeTabsAria`, `homeAddPortfolio`, `homeBalanceAria`, `homeNotificationsAria`, `homeProfileAria`, `homeAccount*`, `homeContacts*`, `homeCardProgress`, `homeCardReportTitle`, `homeCardReportAria`, `homeCardReportPendingTitle`, `homeCardReportPendingAria`, `homeReviewIntro*`, `homeMineNotReady*`, `homeDefaultRole`, `homePlatformWebLetter`, `homeSubmitLocked`, `homeSubmitLockedTitle`, `homeSubmitLockedClose`, `homeSubmitLockedCloseAria`, `homeSubmitCost`.

`homeCardOwnTitle` / `homeCardOwnAria` в locales — legacy (в UI не используются; own-копирайт = `homeCardReport*` / `Pending*`).

`prefers-reduced-motion: reduce` — hide/thumb/label transitions ≈ мгновенные.

См. [`SCREENS.md`](../../../SCREENS.md), [`src/api/README.md`](../../api/README.md).
