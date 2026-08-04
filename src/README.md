# `src/` — код приложения

Клиент: экраны, роутинг, i18n, API, утилиты.  
Карта экранов: [`SCREENS.md`](../SCREENS.md). Продукт: [`PROJECT.md`](../PROJECT.md).

## Верхний уровень

- `main.js` — точка входа: OAuth/boot-проверка Auth, роутер (`go` / `applyRoute`), home query, монтаж экранов, **desktop-only gate** (`viewport.js` + `desktop-only-screen`), iframe-таймер (iframe pause / external wall-clock + `Timer-end.wav`), **надиктовка** (чип rec + микрофон в поле совета) + post-edit через `dictationPolish` (**сейчас off** — `POLISH_ENABLED`), квиз; email/Telegram завершаются через `AuthScreen` → `applyProviderUser`.
- `i18n.js` — локали из `content/locales.json` (+ founder-avatars); реэкспорт `formatPlural`.
- `config.js` — legacy waitlist count (не продуктовый флоу).
- `config/review.js` — `REVIEW_SESSION_SECONDS` (таймер `/review` + intro copy на home) — [`config/README.md`](config/README.md).
- `config/contacts.js` — community Telegram URL.
- `lib/supabaseClient.js` — клиент Supabase (URL + anon) — [`lib/README.md`](lib/README.md).
- `lib/dictation/` — `DictationEngine` (Web Speech MVP) — [`lib/dictation/README.md`](lib/dictation/README.md).
- `api/dictationPolish.js` — Edge `polish-dictation` (пунктуация; не STT; **`POLISH_ENABLED = false`**).
- `data/` — `actionCards.json` + `actionResources.json` (сводный PDF) — [`ACTION_CARDS.md`](../ACTION_CARDS.md).

## Подпапки

| Папка | Роль |
|-------|------|
| `app/` | routes, router, flow, login-session (`obratka.session`) |
| `components/` | UI-экраны; brand: `brand-screen-visual`, `brand-screen-shell`; квиз-шкалы: `scale-slider`; гейт: `desktop-only-screen` |
| `config/` | review session + contacts |
| `data/` | статичные JSON action cards / resources |
| `utils/` | field errors, motion, handoff, mesh, plural, hangingPrepositions, viewport, homeRoute/homeListCache, feedSeen, mineReadySeen, backdropLuminance, consensus/PDF — [`utils/README.md`](utils/README.md) |
| `api/` | Auth, profiles, wallet, portfolios, leagues, referrals, reviewComplaints, presence, rating, **dictationPolish** |
| `assets/` | brand marks / morph + `audio/Timer-end.wav` — [`assets/README.md`](assets/README.md) |
| `lib/` | supabase client + **analytics** + **dictation** (STT); polish — через `api/dictationPolish.js` + Edge |
