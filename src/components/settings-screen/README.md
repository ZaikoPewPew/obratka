# `settings-screen`

Отдельный экран `/settings`, открываемый из меню профиля (`account-menu`).
По `PROJECT.md` / `SCREENS.md` — **UI-заглушка**: локализованный текст (`settings*`) и кнопка возврата на `/home`.

Компонент сообщает о возврате через `onBack`; history и `go()` остаются в
`main.js`. Deep link `/settings` доступен после онбординга (см. `flow.js`).

Стили: `styles/settings-screen.css`. Токены: `--settings-screen-*`.
