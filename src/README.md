# `src/` — код приложения

Клиент: экраны, роутинг, i18n, API, утилиты.  
Карта экранов: [`SCREENS.md`](../SCREENS.md).

## Верхний уровень

- `main.js` — точка входа: OAuth return, роутер (`go` / `applyRoute`), монтаж экранов, iframe-таймер, квиз.
- `i18n.js` — локали из `content/locales.json`.
- `config.js` — константы.
- `lib/supabaseClient.js` — клиент Supabase (URL + anon).

## Подпапки

| Папка | Роль |
|-------|------|
| `app/` | routes, router, flow, login-session |
| `components/` | UI-экраны и виджеты |
| `utils/` | portfolio embed/meta, motion, handoff, PDF |
| `api/` | Auth (Telegram/Google), profiles, wallet, portfolios |
| `assets/` | импортируемые ассеты |
| `lib/` | supabase client |
