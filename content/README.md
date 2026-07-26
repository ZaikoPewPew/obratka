# `content/` — контент и данные

- `locales.json` — **UI-строки** (`ru` / `en`, `supportedLocales`). Правило: `.cursor/rules/i18n.mdc`.
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
| `home*` / `homeInvite*` / `homeNoSlots*` / `homeAlreadyReviewed*` / `homeReviewIntro*` / `homeMineNotReady*` / `homeMineFilter*` / `homeEmptyMineActive` / `homeEmptyMineCompleted` / `homeCardReport*` / `homeCardReportPending*` / `homeCardReviewer*` / `homeTabMineReadyAria` / `homeTabFeedNewAria` / `homeReputation*` / `homeAccount*` / `homeLegendaryOnline*` / `homeRating*` | `/home` (feed/mine/rating топ-50, SWR, intro, mine gate, feedSeen + 3/3, слоты, invite, репутация, «Топы в сети», меню профиля) |
| `modalCloseAria` | общая модалка (`app-modal`) |
| `url*` / `urlModal*` / `urlScreen*` / `urlScreenBack*` | `/portfolio` (в т.ч. чип «На главную») |
| `success*` | `/done` |
| `settings*` | `/settings` (заглушка) |
| `ban*` | `/banned` |
| `reportScreen*` / `reportComplaint*` / `complaintTag*` | `/report` (листы + жалоба; теги v1: `low_effort` · `spam` · `harassment` · `offensive` · `irrelevant`) |
| `review*` / `reviewRec*` / `reviewAdviceRec*` / `report*` / `reportDictationTitle` | `/quiz` (в т.ч. микрофон в поле совета), PDF; rec на `/review` |
| `frame*` / `controls*` | iframe-shell `/review` |

### Auth-защита (ключи)

| Ключ | Назначение |
|------|------------|
| `authCodeResendWait` | Countdown resend: «Повторно через {seconds} с» |
| `authIdentityConflict` | Email уже связан с другим способом входа |
| `authOtpRateLimit` | Слишком много попыток (Auth 429) |

Карта экранов: [`SCREENS.md`](../SCREENS.md).
