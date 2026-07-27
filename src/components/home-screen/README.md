# `home-screen` — главная (лента + мои + рейтинг)

Path: **`/home`**. После onboarding: шапка (лого, репутация, баланс, аватар) + лента карточек портфолио + нижний док: переключатель **На ревью / Мои посты / Рейтинг** и кнопка **«Закинуть своё»** (квадрат с плюсом справа от таббара).

Файл: [`HomeScreen.js`](./HomeScreen.js). Стили: [`styles/home-screen.css`](../../../styles/home-screen.css). Токены `--home-screen-*` в [`styles/tokens.css`](../../../styles/tokens.css). Слева снизу — fixed [`legendary-online-panel`](../legendary-online-panel/) («p4p в сети», poll вместе с home; клик → explainer Figma `492:4009`; скрыт если никого нет). Справа снизу — fixed [`contact-fab`](../contact-fab/) (Telegram, Figma `478:1814`).

## Поведение

### Вкладки

| Вкладка | API | Содержимое |
|---------|-----|------------|
| **На ревью** (`feed`, default) | `listPortfoliosForReview()` | Чужие `pending` **в лиге** грейда ревьюера (RLS), без своих; карточка до `target_reviews` completed-отчётов; `reviewedByMe` = отправленный отчёт (`reviews`), не claim/abort — disabled + оверлей, без модалки; точка на вкладке при **новом** кейсе (`listFeedPortfolioIds` + `feedSeen`); оба запроса режутся `FEED_QUERY_LIMIT` (=300, `created_at` DESC) — защита от неограниченного select при резком наплыве регистраций |
| **Мои посты** (`mine`) | `listMyPortfolios()` | Все портфолио текущего пользователя (pending / done / …); сверху сегмент **Мои на ревью / Мои завершенные** ([`tabs-panel`](../tabs-panel/README.md)); точка на вкладке и на «Мои завершенные» при **непросмотренном** готовом отчёте (`listReadyOwnReportIds` + `mineReadySeen`) |
| **Рейтинг** (`rating`) | `listRatingTop()` | Топ-50 по балансу (Figma `RaitingCard` 482:2123) в `.home-screen__rating-list`: аватар 52 + бейдж места (синий, 20), имя/роль (`formatPortfolioRole`), белая плашка баланса (`min-width`/`height` 52px, padding-x 16px — `--home-screen-rating-balance-*`); skeleton `--skeleton`-модификаторы; empty `.home-screen__rating-empty` (`homeRatingEmpty`); кэш вкладки в `homeListCache` (`rating`); снапшот на сервере обновляется раз в сутки (`rating_leaderboard.sql`) |

Переключатель: `home-screen__tabbar` внутри дока `home-screen__tabbar-dock` — fixed-слой на `home-screen`, **по центру экрана**, `bottom: 16px` (`--home-screen-tabbar-offset` = `--space-4`). Вкладки: **На ревью** / **Мои посты** / **Рейтинг**. Справа от таббара в доке (gap 8px, `--home-screen-tabbar-dock-gap`) — кнопка «Закинуть своё» (56×56, r16, Google blue, плюс 24; токены `--home-screen-tabbar-submit-*`).

- Скролл **вниз** по `home-screen__body` → док (таббар + кнопка) уезжает за нижний край (`home-screen__tabbar-dock--hidden`).
- Скролл **вверх** (любой delta &lt; 0) / у верхнего края / **у низа ленты** → снова виден сразу.
- Hide — с небольшим порогом (`TABBAR_HIDE_DELTA`), чтобы трекпад не дёргал; низ — `TABBAR_BOTTOM_EPS`.
- Анимация hide/show: `--home-screen-tabbar-hide-duration` / `--home-screen-tabbar-hide-ease` → `--motion-screen-*`.

### Фильтр «Мои на ревью / Мои завершенные» (только `mine`)

Над списком — [`createTabsPanel`](../tabs-panel/README.md) (Figma `476:1762`). Виден только на вкладке «Мои»; на `feed` скрыт. Переключение **без** refetch / skeleton — режет уже загруженный `items`.

| Сегмент | Критерий |
|---------|----------|
| **Мои на ревью** (`active`, default) | `reviewsCount < targetReviews` (ещё собираются ревью, 0…2) |
| **Мои завершенные** (`completed`) | `reviewsCount >= targetReviews` (все слоты заполнены, 3/3) |

Empty «Мои завершенные»: `homeEmptyMineCompleted`. На **Мои на ревью** текстового empty нет: всегда до `MAX_MINE_PENDING` (1) слотов — реальная карточка или dashed placeholder «Свободный слот» (`homeMineSlotFree*`, Figma Type=Queue). Cold-miss skeleton там тоже **1** карточка (`MINE_ACTIVE_SKELETON_CARD_COUNT` = `MAX_MINE_PENDING`), не лента из 5. Клик по свободному слоту / CTA «Закинуть» → если слот занят `homePendingLimit*`, если нет монет `homeSubmitLocked*`. Фильтр сбрасывается в `active` на `close()`; при следующем `open()` вид берётся из URL.

### Индикатор на «На ревью»

Красная точка на вкладке (те же `--home-screen-tabbar-tab-dot-*`, 6×6): видна, когда в ленте есть portfolio id, которого ещё нет в `obratka.feedSeen.<userId>`, и пользователь **не** на `feed`.

Поведение:

- открытие вкладки `feed` → текущие id пишутся в seen (`markFeedSeen`), точка гаснет;
- уже на `feed` при poll/visibility — новые id сразу acknowledge (карточка в списке + `revealNewOnly`);
- холодный старт: первый снимок ленты → `seedFeedSeenIfNeeded` (точка не горит на всём списке);
- снова загорается только для **нового** id (ещё не в seen);
- logout → `clearFeedSeen`.

Источник на `mine` / `rating`: лёгкий `listFeedPortfolioIds()` на каждом `refresh`. На `feed` — id из загруженного списка. Aria: `homeTabFeedNewAria`.

### Индикатор на «Мои посты» и «Мои завершенные»

Красная точка:

- на вкладке «Мои посты» — 6×6 (`--home-screen-tabbar-tab-dot-*`, Google red), правый верхний угол, отступ **8px**;
- на сегменте «Мои завершенные» — 7×7 (`--tabs-panel-tab-dot-*`), справа по центру, отступ **22px** от правого края кнопки.

Видна, когда есть **непросмотренный** готовый отчёт: своё портфолио набрало все ревью (`reviewsCount >= targetReviews`), и пользователь ещё не открывал сегмент «Мои завершенные» после появления этих id.

Поведение:

- открытие сегмента `completed` → текущие готовые id пишутся в `obratka.mineReadySeen.<userId>` (`markMineReadySeen`), **обе** точки гаснут сразу;
- заход на вкладку `mine` **сам по себе** точку не гасит (иначе не видно, где новинка);
- снова загорается, только когда появится **новый** готовый id (ещё не в seen);
- logout → `clearMineReadySeen`.

Источник состояния на ленте (`feed`): на каждом `refresh` лёгкий `listReadyOwnReportIds()` (только счётчики) + `hasUnseenMineReady`. На `mine` — те же id из списка своих карточек; acknowledge только на `completed`.

Точка декоративная (`aria-hidden`); пока она видна, у кнопки таба «Мои» `aria-label` = `homeTabMineReadyAria`. Текст вкладки живёт в `home-screen__tab-label` / `tabs-panel__tab-label`, чтобы синк копирайта не затирал точку.

### Контраст над тёмным превью

Пока таббар виден, сэмплим яркость фона под ним (`src/utils/backdropLuminance.js`, scroll / resize / load превью). Сэмплер игнорирует сам tabbar, dock и opaque `home-screen` (иначе светлый screen перехватывает hit-test поверх тёмного превью). Треки полупрозрачные + blur 20: на светлом — gray-900 10% (`--home-screen-tabbar-track-bg`), неактивный текст `--color-text`; на тёмном → `--on-dark` — white 20% (`--home-screen-tabbar-track-bg-on-dark`), неактивный текст `--home-screen-tabbar-tab-color-on-dark`. Transition `--home-screen-tabbar-contrast-*`.

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
| 1 | `reviewedByMe` | ещё не отправил отчёт | уже отправил отчёт (disabled, не claim) |
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
Уже отревьюенная карточка (`reviewedByMe` = строка в `reviews` после submit) — `disabled`, без intro и без notice; статус только оверлеем на превью.
CTA «Закинуть своё» (кнопка в доке у таббара) — всегда активна. Баланс ≥ `SUBMIT_COST` (30) → `onAddPortfolio` → `/portfolio`; иначе `createAppModal` «не хватает монет». Старт с 0 → нужно ~3 чужих ревью (`REVIEW_REWARD` 10).

Лиги (тихий матчинг): junior → junior; middle → junior+middle; senior/lead/head → middle+senior+.  
Клиент-зеркало: [`src/api/leagues.js`](../../api/leagues.js). Сервер: [`supabase/sql/portfolios.sql`](../../../supabase/sql/portfolios.sql) + [`review_claims.sql`](../../../supabase/sql/review_claims.sql) (`can_review_portfolio`, claim-слоты, RLS).

Лента по центру экрана (`--home-screen-body-padding-top` = 16px сверху); снизу запас под таббар (`--home-screen-body-padding-bottom`).  
При `open` / reload cascade сверху вниз (`--home-screen-reveal-delay-*`): topbar (`motion-reveal-topbar`, без `filter`) → body (`motion-reveal`) → tabbar-dock (`motion-reveal-dock`: только `translateY`, **без** `opacity` — иначе у glass tabbar пропадает `backdrop-filter`) → contact-fab. Track / blur / `--on-dark` на самом `.home-screen__tabbar`. Hide/show дока по скроллу не трогает entrance.

Рейтинг слева (топ по валюте) — компонент [`rating/`](../rating/), пока **не монтируется**.

### Профиль и баланс

- Есть `session.avatarUrl` → только фото (круг), буква скрыта; нет URL / ошибка загрузки → тёмный круг + буква имени (картинка скрыта).
- Логотип в шапке — blob-марка (`mark.svg` / `brandMarkSvg`), как на gradient-экранах.
- Empty state ленты — карточка `--home-screen-empty-*` (радиус 24, высота 326, muted-фон, текст по центру).
- Если в `profiles.avatar_url` пусто — при refresh подтягиваем picture из Auth и пишем в профиль.
- При `open` / `refresh` — `refreshWalletFromServer` → `refreshSessionFromProfile`.
- Репутация: `profiles.reputation` ↔ `session.reputation`; чип = иконка + дельта от 100 (`0` / `+10` / `-20`, `formatReputationDelta`); клик → explainer «Репутация в нашей обратке» (`homeReputation*`, Figma `492:3988`): фото + карточка «У тебя N репутация» (та же дельта, что на чипе) из [`assets/home/modal/`](../../assets/home/modal/) (`currency-ghost.png`), secondary CTA «Ясн» → закрыть (без весов тегов).
- Порядок чипов в шапке: репутация → баланс → аватар. «Закинуть своё» — не в шапке, а в доке у таббара; чип уведомлений убран (непросмотренный готовый отчёт — точка на «Мои посты»).
- Баланс: `profiles.balance` ↔ `session.balance`. Экономика: `REVIEW_REWARD = 10`, `SUBMIT_COST = 30` ([`wallet.js`](../../api/wallet.js) / `wallet.mdc`). Клик по чипу → explainer «Валюта сообщества» (`homeBalance*`, Figma `496:4403`): фото + карточка «У тебя N уточек» из [`assets/home/modal/`](../../assets/home/modal/) (`currency-duck.png`, `balance-card-ducks.svg`), secondary CTA «Ясн» → закрыть.
- Подача — RPC `submit_portfolio` (spend 30); legacy `spend_submit_cost`; награда за ревью (+10) — в `handle_review_inserted`.
- CTA «Закинуть своё» без монет → `createAppModal` «Монет маловато»; notices (no slots / already reviewed) — тот же `noticeModal`.
- Клик по аватару профиля → `account-menu` из Figma `467:1320`, раскрывающийся влево от правого края аватара с отступом 16px вниз (без выхода за viewport).
- В меню `displayName` (из `profiles.display_name`) и email не кликабельны; «Настройки» → `/settings`, «Пригласить» → `homeInvite*`-модалка, «Контакты» → `createAppModal`, «Выйти» → полный Supabase `signOut` + очистка локальной сессии.

Логотип в шапке декоративный и не сбрасывает сессию.

## Поля карточки

| Элемент | Источник |
|---------|----------|
| Превью | thum.io через кэш-прокси Edge `portfolio-preview` (`width/1200/crop/620/wait/3`, кэш 24ч + 429-hardening, см. `supabase/functions/portfolio-preview/README.md`); внутри browser-frame `object-fit: cover` + `object-position: top`; до load — skeleton (`--loading`), при error — `--empty` + заглушка viewport `--home-screen-preview-empty-fill` (`#FDEED9`) |
| Карточка | Скругление верх 24 / низ 32 (`--home-screen-card-radius*`); empty-стейты ленты/рейтинга остаются 24 со всех сторон |
| Отчёт отправлен (`reviewedByMe`) | Только после submit отчёта; оверлей на превью (`--home-screen-reviewed-*` + `homeCardReviewedLabel`): колонка иконка → 8px → текст, по центру превью; карточка `disabled`, без клика/модалки |
| Автор | Белая pill-плашка hug по ширине ×52: стек площадки + аватара 60×32 и полный `role` (EN Title Case) |
| Иконка площадки | Simple Icons / favicon; иначе литера **www** (~⅓ круга); 32×32 с **внешней** обводкой 3px (box-shadow); hover → тултип `homePlatformSite` / Behance / Notion / … |
| Аватар | `item.avatarUrl` или буква из `item.name`; 32×32 с внешней белой обводкой 3px; hover → тултип с ФИО |
| Роль | Полная строка `item.role` (например Head Of Design / Senior Product Designer); без известного grade при submit → `gradeUndefined`; иначе fallback `homeDefaultRole` |
| Слоты | Белый чип `.home-screen__card-progress` 108×52 r pill, padding 10; внутри стек 88×32 |
| Пустой слот | 32×32, фон muted, **внешняя** обводка 3px (box-shadow), плюс 18×18; hover → `homeCardReviewerEmpty` |
| Active claim | Анонимный muted-круг с иконкой (`homeCardReviewerAnonymous`); RPC не отдаёт личные данные до завершения ревью |
| Completed | Аватарка; hover → тултип с грейдом (EN) |

Заполнение слотов слева направо, margin −4px; по умолчанию три плюса. Текста «N из 3» нет (есть в aria).

`refresh()` при `open`, смене вкладки, `visibilitychange` и poll (`HOME_SLOTS_POLL_MS` = 45с), пока home открыт — слоты и новые карточки подтягиваются без skeleton (поверх кэша). Своя карточка (`isOwn`, «Мои») всегда кликабельна (`cursor: pointer`, класс `--own`): готово (`reviewsCount >= targetReviews`) → `onOpenReport` → `/report`; иначе `homeMineNotReady*` (не «сразу report»). Title / aria — `homeCardReport*` / `homeCardReportPending*`, синк при silent-патче.

Own-карточки: cursor наследуется от `.home-screen__card` (pointer); `not-allowed` только у `:disabled` — правило `.home-screen__card--own { cursor: not-allowed }` снято.

## Разметка таббара

```
.home-screen__tabbar-dock             (центрирование + hide)
  .home-screen__tabbar                role=tablist
    .home-screen__tabbar-thumb        aria-hidden (пилл)
    button.home-screen__tab           role=tab  data-tab=feed|mine|rating
      .home-screen__tab-label         подпись (только у mine)
      .home-screen__tab-dot           aria-hidden, hidden пока нет непросмотренного 3/3
  button.home-screen__tabbar-submit   «Закинуть своё» (плюс)
```

Классы состояния: `--active` на табе; `home-screen__tabbar-dock--hidden` на доке при скролле вниз; `--on-dark` на tabbar при тёмном фоне под баром.

На `rating`: `.home-screen__feed[hidden]` (карточки не видны — `display: none !important`, иначе flex перебивает `hidden`), рядом `.home-screen__rating` с `.home-screen__rating-empty`.

## API модуля

`createHomeScreen({ onOpenPortfolio, onOpenReport?, onAddPortfolio?, onOpenSettings?, onSignOut?, onViewChange? })` → `{ root, open(view?), close, setItems, setView, getView, refresh, showNotice }`.

Внутреннее: `activeTab` `feed` \| `mine` \| `rating`; `mineFilter` `active` \| `completed`; `refresh` читает соответствующий list API (`listPortfoliosForReview` / `listMyPortfolios` / `listRatingTop`; на чужих вкладках ещё `listFeedPortfolioIds` для точки); кэш вкладок — [`homeListCache.js`](../../utils/homeListCache.js) (`feed`/`mine`/`rating`).

## URL-состояние

Вкладка и фильтр живут в query одного экрана `/home`:

- `/home` — `feed` + `active` (дефолты в query не пишутся);
- `/home?tab=mine` — «Мои посты» / «Мои на ревью»;
- `/home?tab=mine&filter=completed` — «Мои посты» / «Мои завершенные»;
- `/home?tab=rating` — топ-50 по балансу.

[`homeRoute.js`](../../utils/homeRoute.js) парсит и канонизирует query. Клик по основной вкладке добавляет запись History, смена фильтра заменяет текущую; Back/Forward вызывает `setView()` без повторного монтажа экрана и без эха в URL.

- `filter` имеет смысл только при `tab=mine`; мусорный `tab` / `filter` → дефолт + `replace` на канонический URL.
- Экран history **не** трогает: `onViewChange` наверх → `main.js` пишет URL (silent navigate, без re-open).
- Возврат с `/report` и `/settings` — на ту же вкладку (`lastHomeView` в `main.js`).

## Стили / i18n / a11y

Токены `--home-screen-tabbar-*` (высота 56, padding трека 4px, таб 48, offset 16, радиус 16/12, blur 20, translucent track / on-dark track+label, motion hide/thumb/label/contrast) + `--home-screen-tabbar-dock-gap` / `--home-screen-tabbar-submit-*` (кнопка 56×56, r16, Google blue, hover/active через color-mix) + `--home-screen-tabbar-tab-dot-*` (точка 6px, offset 8px, Google red). Точка на сегменте «Мои завершенные»: `--tabs-panel-tab-dot-*` (7px, right 22px).

Glass track: `background` + `backdrop-filter: blur(var(--home-screen-tabbar-blur))` на **`.home-screen__tabbar`** (не на dock). Свап темы: `backdropLuminance` → `home-screen__tabbar--on-dark` (track / label). Не анимировать `opacity` на предке dock — иначе blur пропадает.

Entrance на `--open`: `--home-screen-reveal-delay-topbar` / `-body` / `-tabbar` / `-fab` → `motion-reveal-topbar` / `motion-reveal` / `motion-reveal-dock` / `motion-reveal-topbar`. `motion-reveal-dock` = только `translateX(-50%) translateY(…)`.

Токены intro-модалки: `--home-screen-review-intro-indent` / `--home-screen-review-intro-step-gap`.

Ключи: `homeTitle`, `homeListAria`, `homeListLoadingAria`, `homeListMineAria`, `homeEmpty`, `homeEmptyMine`, `homeEmptyMineActive`, `homeEmptyMineCompleted`, `homeMineSlotFree`, `homeMineSlotFreeAria`, `homePendingLimit*`, `homeTabFeed`, `homeTabMine`, `homeTabRating`, `homeRatingEmpty`, `homeRatingListAria`, `homeRatingNameFallback`, `homeRatingPlaceAria`, `homeRatingBalanceAria`, `homeTabsAria`, `homeMineFilterActive`, `homeMineFilterCompleted`, `homeMineFilterAria`, `homeAddPortfolio`, `homeBalance*`, `homeTabMineReadyAria`, `homeTabFeedNewAria`, `homeProfileAria`, `homeAccount*`, `homeContacts*`, `homeContactFab*`, `homeCardProgress`, `homeCardReportTitle`, `homeCardReportAria`, `homeCardReportPendingTitle`, `homeCardReportPendingAria`, `homeReviewIntro*`, `homeMineNotReady*`, `homeDefaultRole`, `gradeUndefined`, `homePlatformWebLetter`, `homePlatformSite`, `homeSubmitLocked`, `homeSubmitLockedTitle`, `homeSubmitLockedClose`, `homeSubmitLockedCloseAria`, `homeSubmitCost`.

`homeCardOwnTitle` / `homeCardOwnAria` в locales — legacy (в UI не используются; own-копирайт = `homeCardReport*` / `Pending*`).

`prefers-reduced-motion: reduce` — hide/thumb/label transitions ≈ мгновенные; entrance-анимации topbar/body/dock/fab отключены (dock остаётся `translateX(-50%)`).

См. [`SCREENS.md`](../../../SCREENS.md), [`src/api/README.md`](../../api/README.md).
