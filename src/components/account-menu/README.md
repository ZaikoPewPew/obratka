# `account-menu`

Выпадающее меню профиля из Figma `467:1320`. Монтируется внутри
`.home-screen__profile-menu-anchor` и открывается кнопкой аватара.

- Первая строка: `session.displayName`, синхронизированный из `profiles.display_name`.
- Вторая строка: `session.email`.
- Имя и email не интерактивны.
- Интерактивны «Настройки», «Пригласить», «Контакты» и «Выйти».
- Ключи UI: `homeAccount*` (плюс `homeInvite*` для шаринга, `homeContacts*` для ссылки).
- «Настройки» → колбэк → `/settings` (заглушка).
- «Пригласить» открывает `homeInvite*`-модалку (referral share).
- «Контакты» → `COMMUNITY_CONTACT_URL` из `src/config/contacts.js`.
- «Выйти» → `signOut` + `clearHomeListCache` + `clearMineReadySeen` → `/referral`.
- Навигация, модалки и завершение сессии передаются колбэками наверх (без `go()` внутри меню).

Стили: `styles/account-menu.css`. Все размеры, цвета и motion — токены
`--account-menu-*` в `styles/tokens.css`.
