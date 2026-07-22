# `content/` — контент и данные

- `locales.json` — **единый источник строк UI** по языкам (`ru` / `en`, список `supportedLocales`). См. `.cursor/rules/i18n.mdc`.

Новый язык: код в `supportedLocales` + полный набор ключей в `locales` + имя в `LOCALE_NATIVE_NAMES` (`src/i18n.js`).
