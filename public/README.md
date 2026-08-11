# `public/` — публичные ассеты

Файлы из этой папки доступны по URL напрямую (без импорта из JS).

Звуки и импортируемые картинки для UI — в [`src/assets/`](../src/assets/README.md) (через Vite `import`), не здесь.

## Состав

- `assets/svg/favicon.svg` — favicon сайта (`index.html` / `landing`); mark = `logo-default` на rounded square `#242426`.
- `assets/svg/favicon_timer.svg` — alert-favicon при истечении таймера ревью (мигание вкладки, `tabAttention.js`); часы на том же square.
- `assets/svg/home-preview-browser-controls.svg` — контролы превью браузера на home-card (`HomeScreen`).
- `assets/og/og-share.png` — Open Graph / Twitter share image (1200×630); absolute URL в meta через `%SITE_ORIGIN%` / `%SITE_BASE%` (`vite.config.js`).
- `robots.txt` — Allow лендос `/landing/`, Disallow app-path’ов; Sitemap `https://obratka.net/sitemap.xml`.
- `sitemap.xml` — одна URL: лендос (prod absolute).

SPA `index.html` — `noindex, nofollow` (пустой shell не в выдаче); OG/Twitter остаются для превью инвайт-ссылок. Лендос — `index, follow` + canonical.
