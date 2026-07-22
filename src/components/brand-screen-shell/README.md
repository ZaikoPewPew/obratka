# `brand-screen-shell` — общий split-экран

Общий каркас экранов, визуально совпадающих со страницей «Ссылка на портфолио» (`url-screen`).

## Назначение

- Левая панель (`form-pane`) — слот под контент экрана.
- Правая панель (`visual`) — mesh-gradient wash, noise, бренд-марк; **одна и та же** для referral / auth / onboarding / (эталон) url.

## Файл

- `BrandScreenShell.js` — `createBrandScreenShell(opts)` → `{ root, open, close, setContent, getVisualRoot }`.

## Потребители

| Компонент | Левая панель |
|-----------|----------------|
| `url-screen` | поле URL + platforms (после миграции) |
| `referral-screen` | реферальная ссылка / код |
| `auth-screen` | вход / регистрация |
| `onboarding-screen` | вопросы + навигация |

## Motion

При переносе стилей с `url-screen` унаследовать staggered reveal (`--url-screen-reveal-*` → `--brand-screen-reveal-*`). Эталон поведения: `src/components/url-screen/README.md`.

## Стили

Целевой файл: `styles/brand-screen.css` (вынести из блоков `.url-screen` в `iframe-shell.css`). Токены: `--url-screen-*` → со временем `--brand-screen-*` с алиасами для обратной совместимости.

## Не делать

- Не дублировать разметку visual в каждом экране.
- Не класть сырые цвета/px — только токены.
