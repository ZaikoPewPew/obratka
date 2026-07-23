# `src/` — код приложения

Клиент: экраны, роутинг, i18n, API, утилиты.  
Карта экранов: [`SCREENS.md`](../SCREENS.md). Продукт: [`PROJECT.md`](../PROJECT.md).

## Верхний уровень

- `main.js` — точка входа: Google OAuth return, роутер (`go` / `applyRoute`), монтаж экранов, iframe-таймер, квиз; email/Telegram завершаются через `AuthScreen` → `applyProviderUser`.
- `i18n.js` — локали из `content/locales.json` (+ privacy / founder-avatars).
- `config.js` — константы.
- `lib/supabaseClient.js` — клиент Supabase (URL + anon).

## Подпапки

| Папка | Роль |
|-------|------|
| `app/` | routes, router, flow, login-session (`obratka.session`) |
| `components/` | UI-экраны и виджеты (фабрики) |
| `utils/` | portfolio embed/meta, motion, handoff, PDF |
| `api/` | Auth (Email OTP / Telegram / Google + error mapping), profiles, wallet, portfolios |
| `assets/` | импортируемые ассеты |
| `lib/` | supabase client |
