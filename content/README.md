# `content/` — контент и данные

- `locales.json` — **единый источник строк UI** по языкам (`ru` / `en`, список `supportedLocales`). См. `.cursor/rules/i18n.mdc`.
- `onboarding.json` — шаги онбординга (id / type / `labelKey` → locales). См. `onboarding.md`.
- `onboarding.md` — схема JSON онбординга.
- `embed-hosts.md` — каталог площадок портфолио: что можно во iframe, что только во внешней вкладке, спец-embed (Figma/YouTube). Код: `src/utils/embedHosts.js`.

Новый язык: код в `supportedLocales` + полный набор ключей в `locales` + имя в `LOCALE_NATIVE_NAMES` (`src/i18n.js`).

Экраны и ключи `referral*` / `auth*` / `onboarding*` / `home*` / `review*` / `report*`: [`SCREENS.md`](../SCREENS.md).  
Опрос ревью: [`src/components/review-panel/README.md`](../src/components/review-panel/README.md).
