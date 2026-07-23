# Memento — waitlist / Обратка

**Vite**, **vanilla JS**, локализация через `content/locales.json`, Supabase (таблица `subscribers`).  
Продуктовые экраны и path-роутинг: [`SCREENS.md`](SCREENS.md).

## Быстрый старт

```bash
npm install
npm run dev
```

Обычно `http://localhost:5173` → редирект на `/referral`.

Примеры path’ов: `/referral`, `/registration`, `/onboarding`, `/home`, `/portfolio`, `/review`, `/quiz`, `/done`.

### Переменные окружения

`.env` / `.env.local` (в `.gitignore`). Подробности: [`STRUCTURE.md`](STRUCTURE.md).

| Переменная | Назначение |
|------------|------------|
| `SUPABASE_URL` | URL проекта Supabase |
| `SUPABASE_ANON_KEY` | публичный anon key |
| `VITE_BASE_PATH` | base для GitHub Pages (CI: `/obratka/`) |

## Скрипты

| Команда | Назначение |
|---------|------------|
| `npm run dev` | Разработка (Vite HMR) |
| `npm run build` | `dist/` + `404.html` (SPA-fallback) |
| `npm run preview` | Просмотр production-сборки |
| `npm test` | Юнит-тесты (embed, meta, routes) |

## Контент

| Файл | Роль |
|------|------|
| `content/locales.json` | UI-строки, локали |

## Деплой

Статика в `dist/`. На GitHub Pages `404.html` = копия `index.html` для deep link’ов. `SUPABASE_*` нужны на этапе `npm run build`.

## Документация

| Документ | Содержание |
|----------|------------|
| [`SCREENS.md`](SCREENS.md) | Экраны и URL |
| [`src/app/README.md`](src/app/README.md) | Routes / router / flow |
| [`STRUCTURE.md`](STRUCTURE.md) | Папки и env |
| [`PROJECT.md`](PROJECT.md) | Продукт и идеи |
| [`mobile.md`](mobile.md) | Мобильный макет / QA |
| [`.cursor/README.md`](.cursor/README.md) | Карта для агента |
