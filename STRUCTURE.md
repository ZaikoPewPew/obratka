# Структура проекта Memento / Обратка

Что где лежит и зачем.

## Корень

| Файл | Роль |
|------|------|
| `README.md` | Быстрый старт, env, скрипты |
| `PROJECT.md` | Архитектура продукта и заметки |
| `SCREENS.md` | **Экраны + path-роутинг** (referral → … → quiz/done) |
| `STRUCTURE.md` | Этот документ |
| `mobile.md` | Мобильный макет / QA |
| `index.html` | Каркас iframe-оболочки (`/review`) |
| `vite.config.js` | Vite, `VITE_BASE_PATH`, `SUPABASE_*` |
| `package.json` | Скрипты (`build` → ещё `404.html` для SPA) |

## Секреты (не в git)

`.env` / `.env.local` — см. таблицу ниже. Проверка: `git check-ignore -v .env`.

| Файл | В git? |
|------|--------|
| `.gitignore` | да |
| `.env`, `.env*.local` | нет |
| `dist/`, `node_modules/` | нет |

### Переменные

| Переменная | Назначение |
|------------|------------|
| `SUPABASE_URL` / `SUPABASE_ANON_KEY` | API подписчиков |
| `VITE_BASE_PATH` | base для GitHub Pages (`/obratka/`) |

## Папки

| Папка | Роль |
|-------|------|
| `src/` | Код: `main.js`, `app/` (routes), `components/`, `utils/`, `api/` |
| `styles/` | Токены, iframe-shell, entrance, заготовки brand/home |
| `content/` | `locales.json`, onboarding, embed-hosts |
| `public/` | Статика по URL |
| `supabase/` | SQL |
| `.cursor/` | Правила и карта для агента |

## Экраны и URL (кратко)

Полная таблица — [`SCREENS.md`](SCREENS.md) и [`src/app/README.md`](src/app/README.md).

```text
/referral → /registration → /onboarding → /home → /portfolio → /review → /quiz → /quiz/done
```

`/review` = просмотр портфолио + таймер.  
`/quiz` = опрос. Не путать с login-`session.js`.

## Комментарии в JSON

Пояснения к `content/*.json` — соседние `*.md` и `content/README.md`.
