# `public/` — публичные ассеты

Файлы из этой папки доступны по URL напрямую (без импорта из JS).

Звуки и импортируемые картинки для UI — в [`src/assets/`](../src/assets/README.md) (через Vite `import`), не здесь.

## Состав

- `assets/svg/favicon.svg` — favicon сайта (`index.html`).
- `assets/svg/favicon_timer.svg` — alert-favicon при истечении таймера ревью (мигание вкладки, `tabAttention.js`).
- `assets/svg/home-preview-browser-controls.svg` — контролы превью браузера на home-card (`HomeScreen`).
