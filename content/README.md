# `content/` — контент и данные

- `locales.json` — **UI-строки** (`ru` / `en`, `supportedLocales`). Правило: `.cursor/rules/i18n.mdc`.
- `onboarding.json` / `onboarding.md` — шаги онбординга (`/onboarding`).
- `embed-hosts.md` — площадки портфолио (iframe vs external). Код: `src/utils/embedHosts.js`.
- `founder-avatars.json` — аватары (i18n / UI).
- `privacy-policy.json` — текст политики (legacy waitlist / общие блоки).

Новый язык: `supportedLocales` + полный блок ключей + `LOCALE_NATIVE_NAMES` в `src/i18n.js`.

## Префиксы ключей

| Префикс | Экраны |
|---------|--------|
| `referral*` | `/referral` |
| `auth*` / `authEmail*` / `authCode*` / `authOtp*` / `authIdentityConflict` | `/registration`, `/registration/code` |
| `onboarding*` | `/onboarding` |
| `home*` | `/home` (карточки, баланс, stub-модалка подачи) |
| `url*` / `urlModal*` / `urlScreen*` | `/portfolio` |
| `success*` | `/done` |
| `ban*` | `/banned` |
| `review*` / `report*` | `/quiz`, `/quiz/done`, PDF |
| `frame*` / `controls*` | iframe-shell `/review` |

### Auth-защита (ключи)

| Ключ | Назначение |
|------|------------|
| `authCodeResendWait` | Countdown resend: «Повторно через {seconds} с» |
| `authIdentityConflict` | Email уже связан с другим способом входа |
| `authOtpRateLimit` | Слишком много попыток (Auth 429) |

Карта экранов: [`SCREENS.md`](../SCREENS.md).
