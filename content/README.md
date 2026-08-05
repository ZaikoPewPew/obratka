# `content/` — контент и данные

- `locales.json` — **UI-строки** (`ru` / `en`, `supportedLocales`). Правило: `.cursor/rules/i18n.mdc`.
- `rules.json` — текст правил сообщества (`title` / `updated` / `intro` / `sections` по локалям). Строки `body` через `\n` → буллеты в side-panel. Загрузка: `getCommunityRules()` → home side-panel.
- `onboarding.json` / `onboarding.md` — шаги онбординга (`/onboarding`).
- `embed-hosts.md` — площадки портфолио: спец-embed / `EXTERNAL_EMBED_HOSTS` / optimistic + Readymag probe + iframe fallback. Код: `src/utils/embedHosts.js`, `portfolioEmbed.js`.
- `founder-avatars.json` — пул GitHub-источников для стека аватаров (`pickCount` + `sources`). Shuffle: `getFounderAvatarSourcesForPage()` в `src/i18n.js` → unavatar.io. Сейчас: `/referral` ([`referral-screen`](../src/components/referral-screen/README.md)).

Новый язык: `supportedLocales` + полный блок ключей + `LOCALE_NATIVE_NAMES` в `src/i18n.js`.

## Префиксы ключей

| Префикс | Экраны |
|---------|--------|
| `referral*` | `/referral` (validate errors: `referralExhausted`, …) |
| `desktopOnly*` / `metaTitleDesktopOnly` | оверлей «только с компьютера» (&lt;768px) — [`mobile.md`](../mobile.md) |
| `auth*` / `authEmail*` / `authCode*` / `authOtp*` / `authIdentityConflict` | `/registration`, `/registration/code` |
| `onboarding*` / `videoPlayer*` | `/onboarding` (+ VideoPlayerCard) |
| `home*` / `homeInvite*` / `homeNoSlots*` / `homeAlreadyReviewed*` / `homeCardReviewed*` / `homeReviewIntro*` / `homeMineNotReady*` / `homeFeedFilter*` / `homeMineFilter*` / `homeEmptyMineActive` / `homeEmptyMineCompleted` / `homeEmptyFeedReviewed` / `homeMineSlotFree*` / `homePendingLimit*` / `homeNotify*` / `notificationCloseAria` / `homeCardReport*` / `homeCardReportPending*` / `homeCardReviewer*` / `homeTabMineReadyAria` / `homeTabFeedNewAria` / `homeReputation*` / `homeBalance*` / `homeAccount*` / `homeContacts*` / `homeRulesCloseAria` / `homeFeedback*` / `homeLegendaryOnline*` / `homeRating*` | `/home` (Чужие/Мои/Рейтинг топ-50, SWR feed+feedReviewed, Ждёт/Уже + Ещё/Завершенные, intro, mine gate, free-slot / toast, feedSeen + 3/3, слоты, invite `homeInviteMessage`, репутация / уточки, контакты / правила / FAB, «Топы в сети», меню профиля) |
| `gradeUndefined` | подпись без известного `profiles.grade` (карточки / рейтинг / report) |
| `modalCloseAria` | общая модалка (`app-modal`) |
| `url*` / `urlModal*` / `urlScreen*` / `urlScreenBack*` | `/portfolio` (в т.ч. чип «На главную») |
| `success*` | `/done` |
| `settings*` | `/settings` (side-panel профиля, view-only) |
| `ban*` | `/banned` |
| `reportScreen*` / `reportSheet*` / `reportComplaint*` / `complaintTag*` | `/report` (листы → «Посмотреть» в side-panel → жалоба: ровно 1 тег, окно 6ч от done — `reportComplaintWindowClosed`; вне окна кнопку жалобы скрывать; теги v1: `low_effort` · `spam` · `harassment` · `offensive` · `ai_slop`) |
| `reportConsensus*` / `reportAction*` | сводный PDF + action cards ([`ACTION_CARDS.md`](../ACTION_CARDS.md)); подписи ссылок — в `actionResources.json` |
| `review*` / `reviewRec*` / `reviewAbort*` / `reviewAdviceRec*` / `reviewTier*` / `reviewPain*` / `reviewContextShort`·`Value*`·`Hint*` / `reviewVisualShort`·`Value*`·`Hint*` (1–5) / `report*` / `reportDictationTitle` | `/quiz` (шкалы + условный pain + tier + микрофон в совете), PDF; rec + abort confirm на `/review` |
| `frame*` / `controls*` / `embedBlocked*` (`embedBlockedStep*` · `embedBlockedOpen` · `embedBlockedOpenSite` · `embedBlockedAria` · `embedBlockedMediaAria`) | iframe-shell `/review` (в т.ч. external viewer: видео-слот + 4 шага + CTA; после старта CTA → «Открыть сайт») |

### Auth-защита (ключи)

| Ключ | Назначение |
|------|------------|
| `authCodeResendWait` | Countdown resend: «Повторно через {seconds} с» |
| `authIdentityConflict` | Email уже связан с другим способом входа |
| `authOtpRateLimit` | Слишком много попыток (Auth 429) |

Карта экранов: [`SCREENS.md`](../SCREENS.md).
