# `home-screen` — главная (лента + мои + рейтинг)

Path: **`/home`**. После onboarding: шапка (лого, репутация, баланс, аватар) + лента карточек портфолио + нижний док: переключатель **Чужие посты / Мои посты / Рейтинг** и кнопка **«Закинуть своё»** (квадрат с плюсом/замком справа от таббара).

Файл: [`HomeScreen.js`](./HomeScreen.js). Стили: [`styles/home-screen.css`](../../../styles/home-screen.css). Токены `--home-screen-*` в [`styles/tokens.css`](../../../styles/tokens.css). Explainer PNG + Lottie (`rotating-ray`, размеры/цвет): [`src/assets/home/modal/README.md`](../../assets/home/modal/README.md). Слева снизу — fixed [`legendary-online-panel`](../legendary-online-panel/) («p4p в сети», poll вместе с home; клик → explainer Figma `492:4009`; скрыт если никого нет). Справа снизу — fixed [`feedback`](../feedback/) (Telegram).

## Поведение

### Вкладки

| Вкладка | API | Содержимое |
|---------|-----|------------|
| **Чужие посты** (`feed`, default) | `listPortfoliosForReview()` + `listReviewedPortfolios()` | Сверху сегмент **Ждёт ревью / Уже отревьюено** ([`tabs-panel`](../tabs-panel/README.md)); «Ждёт» — чужие `pending` **в лиге** (RLS), без своих и без `reviewedByMe`; «Уже отревьюено» — кейсы с сданным отчётом (`listReviewedPortfolios`, в т.ч. `done` через RLS `exists` review в `portfolios_select_feed`); точка на вкладке при **новом** кейсе только по open-очереди (`listFeedPortfolioIds` + `feedSeen`); лимит `FEED_QUERY_LIMIT` (=300) |
| **Мои посты** (`mine`) | `listMyPortfolios()` | Все портфолио текущего пользователя (pending / done / …); сверху сегмент **Ещё на ревью / Завершенные** ([`tabs-panel`](../tabs-panel/README.md)); точка на вкладке и на «Завершенные» при **непросмотренном** готовом отчёте (`listReadyOwnReportIds` + `mineReadySeen`) |
| **Рейтинг** (`rating`) | `listRatingTop()` | Топ-50 по репутации (Figma `RaitingCard` 482:2123) в `.home-screen__rating-list`: аватар 52 + бейдж места (синий, 20), имя/роль (`formatPortfolioRole`), белая плашка репутации с иконкой positive/neutral/negative (`min-width`/`height` 52px, padding-x 16px — `--home-screen-rating-reputation-*`); skeleton `--skeleton`-модификаторы, 50 карточек (вся длина топа — список скроллится сразу); empty `.home-screen__rating-empty` (`homeRatingEmpty`); кэш вкладки в `homeListCache` (`rating`); снапшот на сервере обновляется раз в сутки (`rating_leaderboard.sql`) |

Переключатель: `home-screen__tabbar` внутри дока `home-screen__tabbar-dock` — fixed-слой на `home-screen`, **по центру экрана**, `bottom: 16px` (`--home-screen-tabbar-offset` = `--space-4`). Вкладки: **Чужие посты** / **Мои посты** / **Рейтинг**. Справа от таббара в доке (gap 8px, `--home-screen-tabbar-dock-gap`) — кнопка «Закинуть своё» (56×56, r16, Google blue, плюс 24; токены `--home-screen-tabbar-submit-*`).

- Скролл **вниз** по `home-screen__body` → док (таббар + кнопка) уезжает за нижний край (`home-screen__tabbar-dock--hidden`).
- Скролл **вверх** (любой delta &lt; 0) / у верхнего края / **у низа ленты** → снова виден сразу.
- Hide — с небольшим порогом (`TABBAR_HIDE_DELTA`), чтобы трекпад не дёргал; низ — `TABBAR_BOTTOM_EPS`.
- Анимация hide/show: `--home-screen-tabbar-hide-duration` / `--home-screen-tabbar-hide-ease` → `--motion-screen-*`.

### Сегмент tabs-panel (`feed` и `mine`)

Над списком — один [`createTabsPanel`](../tabs-panel/README.md) (Figma `476:1762`). Виден на **Чужие посты** и **Мои**; на `rating` скрыт. Лейблы и стейт фильтра раздельные (`feedFilter` / `mineFilter`); переключение сегмента **без** refetch (на feed оба списка уже в кэше после `refresh`); если ещё `loading` — остаётся skeleton с числом карточек сегмента (лента / «Завершенные» = 5, «Ещё на ревью» = 1).

Thumb: `syncListFilterPanel()` переставляет пилл `instant` **только** при рассинхроне (`getActive() !== currentListFilter()`), иначе `syncCopy()` внутри `setListFilter` обрезал бы анимацию своего же переключения. Мгновенный пересчёт после смены вкладки / открытия home — `resyncListFilterThumb()`.

**Чужие посты**

| Сегмент | API / критерий |
|---------|----------------|
| **Ждёт ревью** (`active`, default) | `listPortfoliosForReview()` — open queue |
| **Уже отревьюено** (`completed`) | `listReviewedPortfolios()` — свои сданные отчёты (**pending и done**); RLS `portfolios_select_feed` пускает через `has_reviewed_portfolio` (security definer; сырой exists по reviews даёт circular RLS — см. [`SECURITY.md`](../../../supabase/SECURITY.md) § инцидент 2026-08-04); карточка `--reviewed`: вместо скриншота — серое превью с галочкой + `homeCardReviewedLabel` («Отчёт отправлен») по центру, слоты ревьюеров и зона автора обычные; **некликабельна** (`div`, `pointer-events: none`, без hover / смены курсора / открытия URL) |

Empty «Уже отревьюено»: `homeEmptyFeedReviewed` (визуал free-slot, `--static`). Кэш: `feed` + `feedReviewed` в [`homeListCache`](../../utils/homeListCache.js). Токены статуса: `--home-screen-card-reviewed-*` (заливка `--color-surface-muted`, галочка `--color-success` из `assets/home/report-sent.svg`).

**Мои посты**

| Сегмент | Критерий |
|---------|----------|
| **Ещё на ревью** (`active`, default) | `reviewsCount < targetReviews` (ещё собираются ревью, 0…2) |
| **Завершенные** (`completed`) | `reviewsCount >= targetReviews` (все слоты заполнены, 3/3) |

Empty «Завершенные»: `homeEmptyMineCompleted` (тот же визуал free-slot). На **Ещё на ревью** текстового empty нет: всегда до `MAX_MINE_PENDING` (1) слотов — реальная карточка или dashed placeholder «Свободный слот» (`homeMineSlotFree*`, Figma Type=Queue). Cold-miss skeleton там тоже **1** карточка (`MINE_ACTIVE_SKELETON_CARD_COUNT` = `MAX_MINE_PENDING`), не лента из 5. **Завершенные** / feed «Ждёт»·«Уже» — одинаковые `SKELETON_CARD_COUNT` (5); смена сегмента во время `loading` не сбрасывает skeleton в empty. Клик по свободному слоту / CTA «Закинуть» (с любой вкладки) → если слот занят локально, только flash+buzz submit; если нет монет — buzz submit + чип баланса; иначе сразу `/portfolio` (серверный gate в `applyRoute`). Оба фильтра сбрасываются в `active` на `close()`; при следующем `open()` вид берётся из URL.

### Индикатор на «Чужие посты»

Красная точка на вкладке (те же `--home-screen-tabbar-tab-dot-*`, 6×6): видна, когда в ленте есть portfolio id, которого ещё нет в `obratka.feedSeen.<userId>`, и пользователь **не** на `feed`.

Поведение:

- открытие вкладки `feed` → текущие id пишутся в seen (`markFeedSeen`), точка гаснет;
- уже на `feed` при poll/visibility — новые id сразу acknowledge (карточка в списке + `revealNewOnly`);
- холодный старт: первый снимок ленты → `seedFeedSeenIfNeeded` (точка не горит на всём списке);
- снова загорается только для **нового** id (ещё не в seen);
- logout → `clearFeedSeen`.

Источник на `mine` / `rating`: лёгкий `listFeedPortfolioIds()` на каждом `refresh`. На `feed` — id из загруженного списка. Aria: `homeTabFeedNewAria`.

### Индикатор на «Мои посты» и «Завершенные»

Красная точка:

- на вкладке «Мои посты» — 6×6 (`--home-screen-tabbar-tab-dot-*`, Google red), правый верхний угол, отступ **8px**;
- на сегменте «Завершенные» — 7×7 (`--tabs-panel-tab-dot-*`), справа по центру, отступ **16px** от правого края кнопки.

Видна, когда есть **непросмотренный** готовый отчёт: своё портфолио набрало все ревью (`reviewsCount >= targetReviews`), и пользователь ещё не открывал сегмент «Завершенные» после появления этих id.

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

### Порядок ленты «Ждёт ревью»

Цель: ревьюер чаще открывает то, что **быстрее даёт completed и закрывает слот автора** (дойти до `target_reviews`, default 3). Не newest-first.

Сорт — **клиентский**, в [`src/api/portfolios.js`](../../api/portfolios.js) (`sortFeedForSlotClosure`), **после** `attachReviewerSlots` (слоты для UI; на порядок live не влияют). Home / кэш порядок не меняют — сохраняют то, что вернул API. Вкладка **Мои** — без этого сорта: `created_at` DESC.

Конвейер:

```
list pending (RLS лига) → filter !reviewedByMe → attachReviewerSlots → sortFeedForSlotClosure → setItems / cache
```

Ключи (по убыванию приоритета; стабильный sort, вход не мутируется):

| # | Ключ | Выше | Ниже |
|---|------|------|------|
| 1 | remaining | меньше осталось (`2/3` → `1/3` → `0/3`) | свежие без прогресса |
| 2 | `createdAt` | старше (FIFO) | новее |

Формулы:

- `remaining = max(0, targetReviews − reviewsCount)`
- Дверь claim / `isPortfolioOpenForReview` = `reviewsCount < targetReviews` (live claims **не** закрывают вход); `reviewedByMe` тоже закрывает дверь и **убирает** карточку из open-ленты («Ждёт ревью»)
- Слоты UI = первые `targetReviews` лиц; report — все листы (overshoot ок)

`createdAt` мапится из `portfolios.created_at` в `PortfolioQueueItem` (нужен только tie-break; в UI не показывается).

**Почему не SQL `ORDER BY`:** слоты приходят вторым RPC (`portfolio_reviewer_slots`); финальный порядок после `sortFeedForSlotClosure` (remaining + FIFO). Live не двигает карточку вниз.

**Что не меняем этим сортом:** claim TTL, лиги, `target_reviews`. Видимость `reviewedByMe` — отдельный фильтр до сорта. Весов / explainer порядка в UI нет.

### Лента и карточки

SWR: при `open` / смене таба / F5 — если есть **непустой** кэш вкладки (`feed` / `mine` / `rating`, memory + `sessionStorage` по `userId`), карточки сразу; иначе skeleton (cold miss или кэш `[]`). Затем тихий `refresh()` поверх кэша → cards | empty. Пустой `[]` **не** показывают как empty до confirm — иначе flash «шаром покати». Полный сброс кэша — только logout (`clearHomeListCache`); после успешного submit ревью — `removeCachedHomeListItem` из `feed` (без сочинения `feedReviewed`). Порядок feed в кэше = уже отсортированный ответ `listPortfoliosForReview`.

После skeleton данные с `motion-reveal` stagger; после тихого refetch при тех же id — только патч reviewer-слотов (без пересборки DOM / thum.io); новые карточки — full rebuild + reveal только для новых id.

Клик по чужой карточке → если уже `reviewsCount >= target` (`isPortfolioOpenForReview`) → `homeNoSlots*` + refresh; иначе intro-модалка: тайтл + описание + видео-слот (max 552, Fit `primer.mp4`, autoplay/loop/muted) → `onReviewIntroOpened` + параллельно `onPreviewPortfolio` (prefetch Edge/Readymag embed-probe) → CTA «Сюдаа его!» → `onReviewIntroCta({ action: 'start' })` → `onOpenPortfolio` → `claimPortfolioReview` → `/review` уже с известным iframe/external. «Не сейчас» / закрытие → `onReviewIntroCta({ action: 'dismiss' })` (один раз на закрытие) — без claim; видео стопается.  
Аналитика (колбэки → `track` в `main.js`): `review_intro_opened`, `review_intro_cta` — [`ANALYTICS.md`](../../../ANALYTICS.md).  
Active claims не закрывают дверь; late submit после `done` принимает сервер (+10). На карточке — первые `target` аватарок.  
Abort / hard navigation: release через SPA `releaseHeldClaim` или `pagehide` keepalive + per-tab `sessionStorage` reconcile (см. `review-claims.mdc`) — active «Аноним» не должен залипать после ухода.  
Своя (`isOwn`, вкладка «Мои») кликабельна всегда: собраны все ревью (`reviewsCount >= targetReviews`) → `onOpenReport` → `/report` (листы + жалоба; при overshoot листов может быть > target); иначе explainer `homeMineNotReady*` («Отчёт ещё не готов»: фото [`currency-empty-duck.png`](../../assets/home/modal/currency-empty-duck.png) на фоне `--palette-gray-100` + Lottie `rotating-ray`, те же размеры медиа что у invite, secondary «Ясн»). Title / aria карточки — `homeCardReport*` либо `homeCardReportPending*`, пересинхронизируются при silent-патче слотов.  
Уже отревьюенная (`reviewedByMe` = строка в `reviews` после submit) **не попадает** в open-ленту (`listPortfoliosForReview` / `listFeedPortfolioIds`) и показывается в сегменте «Уже отревьюено» (`listReviewedPortfolios`); повторный claim режется gate / RPC `already_reviewed` → silent refresh.
CTA «Закинуть своё» (кнопка в доке у таббара) — всегда активна, иконка плюс. Иерархия клика: занятый pending-слот (локальный mine-список / кэш) → красный flash + buzz на submit + toast `homeNotifySlotTaken` + `onHomeSubmitClicked({ blocked: 'slot_taken' })`; иначе баланс ≥ `SUBMIT_COST` (30) → `onHomeSubmitClicked({})` → сразу `onAddPortfolio` → `go("url")` без сетевого await; серверный gate слота/монет — в `applyRoute` (deep link / гонка; при отказе по слоту — toast `homeNotifySlotTaken` и redirect на home; там же `home_submit_clicked` с `blocked`). Нет mine-кэша — локальный слот не блокирует, gate только в `applyRoute`. Иначе короткий error-buzz (`motion-control-error-buzz`) на кнопке submit **и** чипе баланса + flash фона submit в `--palette-google-red` на время buzz + toast `homeNotifyNoDucks` + `onHomeSubmitClicked({ blocked: 'no_ducks' })` (без модалки). Переход синий ↔ красный — `transition` по `--home-screen-tabbar-submit-bg-*`. Старт с 0 → нужно ~3 чужих ревью (`REVIEW_REWARD` 10).

Лиги (тихий матчинг): junior → junior; middle → junior+middle; senior/lead/head → middle+senior+.  
Клиент-зеркало: [`src/api/leagues.js`](../../api/leagues.js). Сервер: [`supabase/sql/portfolios.sql`](../../../supabase/sql/portfolios.sql) + [`review_claims.sql`](../../../supabase/sql/review_claims.sql) (`can_review_portfolio`, claim-слоты, RLS).

Лента по центру экрана (`--home-screen-body-padding-top` = 16px сверху); снизу запас под таббар (`--home-screen-body-padding-bottom`).  
При `open` / reload cascade сверху вниз (`--home-screen-reveal-delay-*`): topbar (`motion-reveal-topbar`, без `filter`) → body (`motion-reveal`) → feedback. Tabbar-dock **без** своего slide (`motion-reveal-dock` не вешаем) — проявляется через opacity родителя (свой delayed slide давал рывок после fade; opacity на dock запрещён — ломает glass `backdrop-filter`). Track / blur / `--on-dark` на самом `.home-screen__tabbar`. Hide/show дока по скроллу не трогает entrance.

Рейтинг слева (топ по валюте) — компонент [`rating/`](../rating/), пока **не монтируется**.

### Профиль и баланс

- Есть `session.avatarUrl` → только фото (круг), буква скрыта; нет URL / ошибка загрузки → тёмный круг + буква имени (картинка скрыта).
- Логотип в шапке — wordmark (`logo.svg` **100×24**, `?raw` + `currentColor`), кнопка → вкладка «Чужие посты» (`feed`); уже на `feed` — скролл вверх. Тот же клик на settings → `/home` на `feed` (`homeMarkAria`).
- Empty state ленты и «Завершенные» (`homeEmpty` / `homeEmptyMineCompleted`) — тот же визуал, что у свободного слота (`--home-screen-slot-empty-*`: dashed-рамка, превью с текстом по центру, два meta-пилла), но некликабельный (`home-screen__card--static`); разметка из общей `createSlotEmptyVisual`.
- Если в `profiles.avatar_url` пусто — при refresh подтягиваем picture из Auth и пишем в профиль.
- При `open` / `refresh` — `refreshWalletFromServer` → `refreshSessionFromProfile`.
- Репутация: `profiles.reputation` ↔ `session.reputation`; чип = inline SVG + абсолют без плюса (`100` / `0` / `-20`, `formatReputation`); иконка по знаку (`>0` positive · `=0` neutral · `<0` negative); глазки медленно смотрят направо → налево → прямо с паузами (`motion-reputation-eyes-look`, `--motion-reputation-eyes-*`); hover/focus → denser infinite без idle-паузы (`motion-reputation-eyes-look-once`, `--motion-reputation-eyes-hover-duration`, класс `home-screen__chip--icon-boost`; уход — доигрываем цикл → idle; повторный hover mid-cycle не рестартит); клик → explainer «Репутация» (`homeReputation*`, Figma `492:3988`): фото [`currency-ghost.png`](../../assets/home/modal/currency-ghost.png) + Lottie `rotating-ray` (552×268, без подложки), secondary «Ясн». В description ссылка `homeReputationDescLink` («правилам сообщества?») открывает ту же side-panel с правилами, что и пункт меню «Правила».
- Порядок чипов в шапке: репутация → баланс → аватар. «Закинуть своё» — не в шапке, а в доке у таббара; чип уведомлений убран (непросмотренный готовый отчёт — точка на «Мои посты»).
- Баланс: `profiles.balance` ↔ `session.balance`. Экономика: `REVIEW_REWARD = 10`, `SUBMIT_COST = 30` ([`wallet.js`](../../api/wallet.js) / `wallet.mdc`). Иконка уточки на чипе легонько покачивается на месте (`motion-balance-duck-float`, `--motion-balance-duck-*`: покой → волны → покой); hover/focus → denser infinite без idle-паузы (`motion-balance-duck-float-once`, `--motion-balance-duck-hover-duration`, класс `home-screen__chip--icon-boost`; уход — доигрываем цикл → idle; повторный hover mid-cycle не рестартит); клик → explainer «Уточки» (`homeBalance*`, Figma `496:4403`): фото [`currency-duck.png`](../../assets/home/modal/currency-duck.png) + Lottie `rotating-ray` (552×268, без подложки), secondary «Ясн».
- Подача — RPC `submit_portfolio` (spend 30); legacy `spend_submit_cost`; награда за ревью (+10) — в `handle_review_inserted`.
- CTA «Закинуть своё»: всегда плюс; слот занят локально → flash+buzz submit + toast `homeNotifySlotTaken`; иначе без монет → buzz submit + чип баланса + flash фона + toast `homeNotifyNoDucks` (`motion-control-error-buzz`, `--home-screen-tabbar-submit-bg-error` / `--motion-control-error-buzz-*`); серверный gate — `applyRoute` (`hasFreeMineSlot` параллельно с `reconcileSessionAccess`; **ошибка count ≠ слот занят** — fail-open, лимит в RPC `too_many_pending`); notices (no slots / already reviewed) — `noticeModal`; toast — `createNotification` / `showNotification`.
- Клик по аватару профиля → `account-menu` из Figma `467:1320`, раскрывающийся влево от правого края аватара с отступом 16px вниз (без выхода за viewport).
- В меню `displayName` (из `profiles.display_name`) и email не кликабельны; «Профиль» → `/settings` (side-panel поверх home, view-only); «Пригласить» → explainer `homeInvite*` (Figma `492:4030`): фото [`currency-referal.png`](../../assets/home/modal/currency-referal.png) на фоне `--palette-gray-100` + Lottie `rotating-ray` между фоном и PNG + бар `uses из max` / код + copy / «Поделиться»; copy кладёт полный текст `homeInviteMessage` (`{url}`, `{code}`) с анимацией иконка→галлочки→иконка; «Поделиться» открывает кастомное меню у кнопки (Telegram / WhatsApp) — нативный `navigator.share` не используем (на macOS лист не привязан к кнопке); при `uses >= max` — текст `homeInviteCodeExhausted`, статичные галочки, без share (бар на всю ширину); модалка без CTA (закрытие крестиком / backdrop); «Правила» → `createSidePanel` + [`content/rules.json`](../../../content/rules.json) (Figma `517:4740`); «Выйти» → полный Supabase `signOut` + очистка локальной сессии. Связь с админом — FAB `feedback`.

Логотип в шапке декоративный и не сбрасывает сессию.

## Поля карточки

| Элемент | Источник |
|---------|----------|
| Превью | thum.io через кэш-прокси Edge `portfolio-preview` (`width/1200/crop/620/wait/3`, кэш 24ч + 429-hardening, см. `supabase/functions/portfolio-preview/README.md`); внутри browser-frame `object-fit: cover` + `object-position: top`; до load — skeleton (`--loading`), при error — `--empty` + заглушка viewport `--home-screen-preview-empty-fill` (`#FDEED9`) |
| Карточка | Скругление верх 24 / низ 32 (`--home-screen-card-radius*`); empty-стейты ленты/рейтинга остаются 24 со всех сторон |
| Автор | Белая pill-плашка hug по ширине ×52: стек площадки + аватара 60×32 и полный `role` (EN Title Case) |
| Иконка площадки | Simple Icons / favicon; иначе литера **www** (~⅓ круга); 32×32 с **внешней** обводкой 3px (box-shadow); hover → тултип `homePlatformSite` / Behance / Notion / … |
| Аватар | `item.avatarUrl` или буква из `item.name`; 32×32 с внешней белой обводкой 3px; hover → тултип с ФИО |
| Роль | Полная строка `item.role` (например Head Of Design / Senior Product Designer); без известного grade при submit → `gradeUndefined`; иначе fallback `homeDefaultRole` |
| Слоты | Белый чип `.home-screen__card-progress` 108×52 r pill, padding 10; внутри стек 88×32 |
| Пустой слот | 32×32, фон muted, **внешняя** обводка 3px (box-shadow), плюс 18×18; hover → `homeCardReviewerEmpty` |
| Active claim | Анонимный muted-круг с иконкой (`homeCardReviewerAnonymous`); RPC не отдаёт личные данные до завершения ревью |
| Completed | Аватарка; hover → тултип с грейдом (EN) |

Заполнение слотов слева направо, margin −4px; по умолчанию три плюса. Текста «N из 3» нет (есть в aria).

`refresh()` при `open`, смене вкладки, `visibilitychange` и poll (`HOME_SLOTS_POLL_MS` = 45с), пока home открыт — слоты и новые карточки подтягиваются без skeleton (поверх кэша). Wallet / списки вкладки / online стартуют параллельно; после отрисовки списка — `syncCopy` из wallet и хвост `mineReady` ∥ `feedUnseen` ∥ online. После успешного feed — фоновый prefetch `mine` в кэш (skip при непустом hit; guard `refreshEpoch` + `userId`). Своя карточка (`isOwn`, «Мои») всегда кликабельна (`cursor: pointer`, класс `--own`): готово (`reviewsCount >= targetReviews`) → `onOpenReport` → `/report`; иначе `homeMineNotReady*` (не «сразу report»). Title / aria — `homeCardReport*` / `homeCardReportPending*`, синк при silent-патче.

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

`createHomeScreen({ onOpenPortfolio, onPreviewPortfolio?, onOpenReport?, onAddPortfolio?, onOpenSettings?, onSignOut?, onViewChange?, onReviewIntroOpened?, onReviewIntroCta?, onHomeSubmitClicked? })` → `{ root, open(view?), close, setItems, setView, getView, refresh, showNotice, showNotification }`.

Внутреннее: `activeTab` `feed` \| `mine` \| `rating`; `feedFilter` / `mineFilter` `active` \| `completed`; `refresh` параллелит wallet∥lists∥online, на feed тянет open + reviewed и фоном prefetch `mine`; на mine / rating — `listMyPortfolios` / `listRatingTop`; на чужих вкладках ещё `listFeedPortfolioIds` для точки; кэш — [`homeListCache.js`](../../utils/homeListCache.js) (`feed`/`feedReviewed`/`mine`/`rating`).

## URL-состояние

Вкладка и фильтр живут в query одного экрана `/home`:

- `/home` — `feed` + `active` (дефолты в query не пишутся);
- `/home?filter=completed` — «Чужие посты» / «Уже отревьюено»;
- `/home?tab=mine` — «Мои посты» / «Ещё на ревью»;
- `/home?tab=mine&filter=completed` — «Мои посты» / «Завершенные»;
- `/home?tab=rating` — топ-50 по репутации.

[`homeRoute.js`](../../utils/homeRoute.js) парсит и канонизирует query. Клик по основной вкладке добавляет запись History, смена фильтра заменяет текущую; Back/Forward вызывает `setView()` без повторного монтажа экрана и без эха в URL.

- `filter` имеет смысл на `feed` и `mine`; мусорный `tab` / `filter` → дефолт + `replace` на канонический URL.
- Экран history **не** трогает: `onViewChange` наверх → `main.js` пишет URL (silent navigate, без re-open).
- Возврат с `/report` и `/settings` — на ту же вкладку (`lastHomeView` в `main.js`).

## Стили / i18n / a11y

Токены `--home-screen-tabbar-*` (высота 56, padding трека 4px, таб 48, offset 16, радиус 16/12, blur 20, translucent track / on-dark track+label, motion hide/thumb/label/contrast) + `--home-screen-tabbar-dock-gap` / `--home-screen-tabbar-submit-*` (кнопка 56×56, r16, Google blue, hover/active через color-mix; error-flash Google red + `bg-duration`/`bg-ease` для transition синий↔красный; плюс 24) + `--home-screen-tabbar-tab-dot-*` (точка 6px, offset 8px, Google red). Точка на сегменте «Завершенные»: `--tabs-panel-tab-dot-*` (7px, right 16px). Статус «Отчёт отправлен» в превью: `--home-screen-card-reviewed-*`.

Glass track: `background` + `backdrop-filter: blur(var(--home-screen-tabbar-blur))` на **`.home-screen__tabbar`** (не на dock). Свап темы: `backdropLuminance` → `home-screen__tabbar--on-dark` (track / label). Не анимировать `opacity` на предке dock — иначе blur пропадает.

Entrance на `--open`: `--home-screen-reveal-delay-topbar` / `-body` / `-fab` → `motion-reveal-topbar` / `motion-reveal` / `motion-reveal-topbar`. Dock без delayed animation — только parent fade + базовый `translateX(-50%)`.

Токены intro-модалки: `--home-screen-review-intro-media-*` (max 552, aspect кадра).

Ключи: `homeTitle`, `homeMarkAria`, `homeListAria`, `homeListLoadingAria`, `homeListMineAria`, `homeEmpty`, `homeEmptyMine`, `homeEmptyMineActive`, `homeEmptyMineCompleted`, `homeEmptyFeedReviewed`, `homeMineSlotFree`, `homeMineSlotFreeAria`, `homePendingLimit*`, `homeNotifyNoDucks`, `homeNotifySlotTaken`, `notificationCloseAria`, `homeTabFeed`, `homeTabMine`, `homeTabRating`, `homeRatingEmpty`, `homeRatingListAria`, `homeRatingNameFallback`, `homeRatingPlaceAria`, `homeRatingReputationAria`, `homeTabsAria`, `homeFeedFilterActive`, `homeFeedFilterCompleted`, `homeFeedFilterAria`, `homeMineFilterActive`, `homeMineFilterCompleted`, `homeMineFilterAria`, `homeCardReviewedLabel`, `homeAddPortfolio`, `homeBalance*`, `homeReputation*`, `homeInvite*` (в т.ч. `homeInviteMessage`), `homeTabMineReadyAria`, `homeTabFeedNewAria`, `homeProfileAria`, `homeAccount*`, `homeRulesCloseAria`, `homeFeedback*`, `homeCardProgress`, `homeCardReportTitle`, `homeCardReportAria`, `homeCardReportPendingTitle`, `homeCardReportPendingAria`, `homeReviewIntro*`, `homeMineNotReady*`, `homeDefaultRole`, `gradeUndefined`, `homePlatformWebLetter`, `homePlatformSite`, `homeSubmitCost`. Правила сообщества: [`content/rules.json`](../../../content/rules.json).

`homeCardOwnTitle` / `homeCardOwnAria` / `homeAlreadyReviewed*` в locales — legacy (own-копирайт = `homeCardReport*` / `Pending*`; модалка already-reviewed не показывается — silent refresh).

`prefers-reduced-motion: reduce` — hide/thumb/label transitions ≈ мгновенные; entrance topbar/body/fab, idle глазки/уточка и `motion-control-error-buzz` отключены (dock и так без entrance-slide, остаётся `translateX(-50%)`).

См. [`SCREENS.md`](../../../SCREENS.md), [`src/api/README.md`](../../api/README.md).
