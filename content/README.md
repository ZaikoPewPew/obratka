# `content/` — контент и данные

- `locales.json` — **UI-строки** (`ru` / `en`, `supportedLocales`). Правило: `.cursor/rules/i18n.mdc`.
- `onboarding.json` / `onboarding.md` — шаги онбординга (`/onboarding`).
- `embed-hosts.md` — площадки портфолио (iframe vs external). Код: `src/utils/embedHosts.js`.

Новый язык: `supportedLocales` + полный блок ключей + `LOCALE_NATIVE_NAMES` в `src/i18n.js`.

## Префиксы ключей

| Префикс | Экраны |
|---------|--------|
| `referral*` | `/referral` |
| `auth*` | `/registration` (в т.ч. Telegram/Google errors) |
| `onboarding*` | `/onboarding` |
| `home*` | `/home` (карточки, баланс, dev-кнопки) |
| `url*` / `urlModal*` / `urlScreen*` | `/portfolio` |
| `success*` | `/done` |
| `review*` / `report*` | `/quiz`, `/quiz/done`, PDF |

Карта экранов: [`SCREENS.md`](../SCREENS.md).
