# `content/` — контент и данные

- `locales.json` — **UI-строки** (`ru` / `en`, `supportedLocales`). Правило: `.cursor/rules/i18n.mdc`.
- `rules.json` — текст правил сообщества (`title` / `updated` / `intro` / `sections` по локалям). Строки `body` через `\n` → буллеты в side-panel. Загрузка: `getCommunityRules()` / `getLegalDoc("rules")`.
- `privacy.json` — политика обработки ПДн (та же схема). `getPrivacyPolicy()` / `getLegalDoc("privacy")`.
- `terms.json` — пользовательское соглашение (та же схема). `getTermsOfService()` / `getLegalDoc("terms")`.
- Рендер в панель: `fillSidePanelDoc()` в [`src/utils/legalDoc.js`](../src/utils/legalDoc.js) (home, landing, `/registration`).
- `onboarding.json` / `onboarding.md` — шаги онбординга (`/onboarding`).
- `embed-hosts.md` — площадки портфолио: спец-embed / `EXTERNAL_EMBED_HOSTS` / optimistic + Readymag probe + iframe fallback. Код: `src/utils/embedHosts.js`, `portfolioEmbed.js`.
- `founder-avatars.json` — пул GitHub-источников для стека аватаров (`pickCount` + `sources`). Shuffle: `getFounderAvatarSourcesForPage()` в `src/i18n.js` → unavatar.io. Сейчас: `/referral` ([`referral-screen`](../src/components/referral-screen/README.md)).

Новый язык: `supportedLocales` + полный блок ключей + `LOCALE_NATIVE_NAMES` в `src/i18n.js`.

## Префиксы ключей

| Префикс | Экраны |
|---------|--------|
| `referral*` | `/referral` (validate errors: `referralExhausted`, …) |
| `metaTitle*` | `document.title` по роуту (`src/utils/documentTitle.js`); fallback `metaTitle`; `metaTitleAttention` / `metaTitleDesktopOnly` — оверлеи |
| `desktopOnly*` / `metaTitleDesktopOnly` | оверлей «только с компьютера» (&lt;768px) — [`mobile.md`](../mobile.md) |
| `notFound*` / `metaTitleNotFound` | SPA `/404` (`not-found-screen`) |
| `auth*` / `authEmail*` / `authCode*` / `authOtp*` / `authIdentityConflict` / `authConsent*` / `authLegalCloseAria` | `/registration`, `/registration/code` (Email UI off; consent под кнопками провайдеров) |
| `onboarding*` / `videoPlayer*` | `/onboarding` (+ VideoPlayerCard) |
| `home*` / `homeInvite*` / `homeInviteShare*` / `homeNoSlots*` / `homeAlreadyReviewed*` / `homeCardReviewed*` / `homeReviewIntro*` / `homeMineNotReady*` / `homeFeedFilter*` / `homeMineFilter*` / `homeEmptyMineActive` / `homeEmptyMineCompleted` / `homeEmptyFeedReviewed` / `homeMineSlotFree*` / `homePendingLimit*` / `homeNotify*` / `notificationCloseAria` / `homeCardReport*` / `homeCardReportPending*` / `homeCardMinePendingRole` / `homeCardReviewer*` / `homeTabMineReadyAria` / `homeTabFeedNewAria` / `homeReputation*` / `homeBalance*` / `homeAccount*` / `homeContacts*` / `homeRulesCloseAria` / `homeFeedback*` / `homeLegendaryOnline*` / `homeRating*` | `/home` (Чужие/Мои; рейтинг UI off `RATING_TAB_ENABLED`; SWR feed+feedReviewed, Ждёт/Уже + Ещё/Завершенные, intro, mine gate, free-slot / toast, feedSeen + 3/3, слоты, invite `homeInviteMessage` + share Telegram/X/Threads/LinkedIn, репутация / уточки, контакты / правила / FAB, «Топы в сети», меню профиля) |
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
