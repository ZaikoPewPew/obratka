# `settings-screen`

Отдельный экран `/settings`, открываемый из меню профиля. Пока показывает
локализованную заглушку и кнопку возврата на `/home`.

Компонент сообщает о возврате через `onBack`; history и `go()` остаются в
`main.js`.

Стили: `styles/settings-screen.css`. Токены: `--settings-screen-*`.
