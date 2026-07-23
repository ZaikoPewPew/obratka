# `content/` — контент и данные

- `locales.json` — **UI-строки** (`ru` / `en`, `supportedLocales`). Правило: `.cursor/rules/i18n.mdc`.
- `onboarding.json` / `onboarding.md` — шаги онбординга (`/onboarding`).
- `embed-hosts.md` — площадки портфолио (iframe vs external). Код: `src/utils/embedHosts.js`.

Новый язык: `supportedLocales` + полный блок ключей + `LOCALE_NATIVE_NAMES` в `src/i18n.js`.

## Префиксы ключей

| Префикс | Экраны |
|---------|--------|
| `referral*` | `/referral` |
| `auth*` | `/registration` |
| `onboarding*` | `/onboarding` |
| `home*` | `/home` |
| `url*` / `urlModal*` / `urlScreen*` | `/portfolio` |
| `review*` / `report*` | `/quiz`, `/quiz/done`, PDF |

Карта экранов: [`SCREENS.md`](../SCREENS.md).
