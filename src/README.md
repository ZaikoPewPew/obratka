# `src/` — код приложения

Клиент: экраны, роутинг, i18n, API, утилиты.  
Карта экранов: [`SCREENS.md`](../SCREENS.md). Продукт: [`PROJECT.md`](../PROJECT.md).

## Верхний уровень

- `main.js` — точка входа: Google OAuth return, роутер (`go` / `applyRoute`), монтаж экранов, iframe-таймер, **надиктовка** (чип rec + микрофон в поле совета), квиз; email/Telegram завершаются через `AuthScreen` → `applyProviderUser`.
- `i18n.js` — локали из `content/locales.json` (+ privacy / founder-avatars).
- `config.js` — legacy waitlist count (не продуктовый флоу).
- `config/review.js` — `REVIEW_SESSION_SECONDS` (таймер `/review` + intro copy на home).
- `config/contacts.js` — community Telegram URL.
- `lib/supabaseClient.js` — клиент Supabase (URL + anon).
- `lib/dictation/` — `DictationEngine` (Web Speech MVP) — [`lib/dictation/README.md`](lib/dictation/README.md).

## Подпапки

| Папка | Роль |
|-------|------|
| `app/` | routes, router, flow, login-session (`obratka.session`) |
| `components/` | UI-экраны; brand: `brand-screen-visual`, `brand-screen-shell` |
| `config/` | review session + contacts |
| `utils/` | field errors, motion, handoff, mesh, homeListCache, mineReadySeen, backdropLuminance, PDF — [`utils/README.md`](utils/README.md) |
| `api/` | Auth, profiles, wallet, portfolios, referrals, reviewComplaints |
| `assets/` | brand marks / morph — [`assets/README.md`](assets/README.md) |
| `lib/` | supabase client + **dictation** |
