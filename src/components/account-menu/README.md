# `account-menu`

Выпадающее меню профиля из Figma `467:1320`. Монтируется внутри
`.home-screen__profile-menu-anchor` и открывается кнопкой аватара.

- Первая строка: `session.displayName`, синхронизированный из `profiles.display_name`.
- Вторая строка: `session.email`.
- Имя и email не интерактивны.
- Интерактивны «Настройки», «Пригласить», «Контакты» и «Выйти».
- «Пригласить» открывает `homeInvite*`-модалку (referral share).
- Навигация, модалки и завершение сессии передаются колбэками наверх.

Стили: `styles/account-menu.css`. Все размеры, цвета и motion — токены
`--account-menu-*` в `styles/tokens.css`.
