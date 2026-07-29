# `content/` — контент и данные

- `locales.json` — **UI-строки** (`ru` / `en`, `supportedLocales`). Правило: `.cursor/rules/i18n.mdc`.
- `rules.json` — текст правил сообщества (`title` / `updated` / `intro` / `sections` по локалям). Строки `body` через `\n` → буллеты в side-panel. Загрузка: `getCommunityRules()` → home side-panel.
- `onboarding.json` / `onboarding.md` — шаги онбординга (`/onboarding`).
- `embed-hosts.md` — площадки портфолио (iframe vs external). Код: `src/utils/embedHosts.js`.
- `founder-avatars.json` — пул GitHub-источников для стека аватаров (`pickCount` + `sources`). Shuffle: `getFounderAvatarSourcesForPage()` в `src/i18n.js` → unavatar.io. Сейчас: `/referral` ([`referral-screen`](../src/components/referral-screen/README.md)).

Новый язык: `supportedLocales` + полный блок ключей + `LOCALE_NATIVE_NAMES` в `src/i18n.js`.

## Префиксы ключей

| Префикс | Экраны |
|---------|--------|
| `referral*` | `/referral` (validate errors: `referralExhausted`, …) |
| `auth*` / `authEmail*` / `authCode*` / `authOtp*` / `authIdentityConflict` | `/registration`, `/registration/code` |
| `onboarding*` | `/onboarding` |
| `home*` / `homeInvite*` / `homeNoSlots*` / `homeAlreadyReviewed*` / `homeReviewIntro*` / `homeMineNotReady*` / `homeMineFilter*` / `homeEmptyMineActive` / `homeEmptyMineCompleted` / `homeMineSlotFree*` / `homePendingLimit*` / `homeCardReport*` / `homeCardReportPending*` / `homeCardReviewer*` / `homeTabMineReadyAria` / `homeTabFeedNewAria` / `homeReputation*` / `homeBalance*` / `homeBalanceCardTitleOne`·`Few`·`Many`·`Other` / `homeAccount*` / `homeContacts*` / `homeRulesCloseAria` / `homeContactFab*` / `homeLegendaryOnline*` / `homeRating*` | `/home` (feed/mine/rating топ-50, SWR, intro, mine gate, free-slot / pending-limit, feedSeen + 3/3, слоты, invite `homeInviteMessage`, репутация / баланс + tip + plural-карточка, контакты / правила / FAB, «Топы в сети», меню профиля) |
| `gradeUndefined` | подпись без известного `profiles.grade` (карточки / рейтинг / report) |
| `modalCloseAria` | общая модалка (`app-modal`) |
| `url*` / `urlModal*` / `urlScreen*` / `urlScreenBack*` | `/portfolio` (в т.ч. чип «На главную») |
| `success*` | `/done` |
| `settings*` | `/settings` (заглушка) |
| `ban*` | `/banned` |
| `reportScreen*` / `reportComplaint*` / `complaintTag*` | `/report` (листы + жалоба: ровно 1 тег, окно 6ч от done — `reportComplaintWindowClosed`; вне окна кнопку скрывать; теги v1: `low_effort` · `spam` · `harassment` · `offensive` · `ai_slop`) |
| `review*` / `reviewRec*` / `reviewAdviceRec*` / `reviewTier*` / `reviewPain*` / `reviewContextShort`·`Value*`·`Hint*` / `reviewVisualShort`·`Value*`·`Hint*` (1–5) / `report*` / `reportDictationTitle` | `/quiz` (шкалы + условный pain + tier + микрофон в совете), PDF; rec на `/review` |
| `frame*` / `controls*` / `embedBlocked*` | iframe-shell `/review` (в т.ч. external viewer) |

### Auth-защита (ключи)

| Ключ | Назначение |
|------|------------|
| `authCodeResendWait` | Countdown resend: «Повторно через {seconds} с» |
| `authIdentityConflict` | Email уже связан с другим способом входа |
| `authOtpRateLimit` | Слишком много попыток (Auth 429) |

Карта экранов: [`SCREENS.md`](../SCREENS.md).
