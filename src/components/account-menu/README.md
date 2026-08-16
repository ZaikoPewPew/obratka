# `account-menu`

Выпадающее меню профиля из Figma `467:1320`. Монтируется внутри
`.home-screen__profile-menu-anchor` и открывается кнопкой аватара.

- Первая строка: `session.displayName`, синхронизированный из `profiles.display_name`.
- Вторая строка: `session.email`.
- Имя и email не интерактивны.
- Интерактивны «Профиль», «Пригласить», «Сообщество», «Правила» и «Выйти».
- Ключи UI: `homeAccount*` (плюс `homeInvite*` для шаринга, `homeRulesCloseAria` для side-panel).
- «Профиль» → колбэк → `/settings` (side-panel, view-only).
- «Пригласить» открывает `homeInvite*`-модалку; copy и share кладут полный текст `homeInviteMessage` (`{url}`, `{code}`), не только код или ссылку.
- «Сообщество» → `TELEGRAM_COMMUNITY_URL` (`t.me/obratka_dsgn`) в новой вкладке; колбэк `onCommunity` для аналитики.
- «Правила» → `createSidePanel` с текстом из `content/rules.json` (`getLegalDoc("rules")` + `fillSidePanelDoc`). Политика и соглашение — на `/registration` и в футере лендинга, не в меню.
- Связь с админом — через FAB (`feedback`), не пункт меню.
- «Выйти» → `signOut` + `clearHomeListCache` + `clearMineReadySeen` + `clearFeedSeen` → `/referral`.
- Навигация, модалки / side-panel и завершение сессии передаются колбэками наверх (без `go()` внутри меню).

Стили: `styles/account-menu.css`. Все размеры, цвета и motion — токены
`--account-menu-*` в `styles/tokens.css`.
