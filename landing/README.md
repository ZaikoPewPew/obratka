# Landing (промо)

Отдельный Vite entry: свой HTML/CSS/JS. Без `src/api/*`, session, Supabase, claims.

Prod: https://zaikopewpew.github.io/obratka/landing/  
Карта продукта: [`SCREENS.md`](../SCREENS.md). Структура: [`STRUCTURE.md`](../STRUCTURE.md).

## Локально

```bash
npm run dev
```

Открыть: [http://localhost:5173/landing/](http://localhost:5173/landing/)

## Блоки

1. **Шапка** — лого + CTA инвайт  
2. **Hero** — бренд, крупный заголовок, lead, CTA + mesh (`createBrandScreenVisual`)  
3. **Боль** — зачем нужна обратка  
4. **Преимущества** — 4 пункта (лига, лист, таймер, репутация)  
5. **Закрытие** — invite-only + CTA  

## Изоляция

| Можно | Нельзя |
|-------|--------|
| Токены `--landing-*`, `createBrandScreenVisual`, `fixHangingPrepositions` | `src/api/*`, `src/main.js`, `src/app/session.js` |
| CTA → `/referral` (+ `?ref=` через `import.meta.env.BASE_URL`) | Писать в `obratka.session` / invite gate |
| Свои строки в HTML (не `locales.json`) | Монтировать продуктовые экраны |

Копирайт лендоса **не** в `content/locales.json` — статичный HTML + `data-fix-hanging` для висячих предлогов.

## Файлы

| Путь | Роль |
|------|------|
| `landing/index.html` | Разметка |
| `landing/src/main.js` | CTA href, hanging prepositions, mesh visual |
| `landing/styles/landing.css` | Стили (только `var(--landing-*)` / семантика из `tokens.css`) |
| `styles/tokens.css` | `--landing-*` |

## Сборка / Pages

`vite.config.js` → MPA input `landing` → `dist/landing/index.html`.  
`npm run build` (CI с `VITE_BASE_PATH=/obratka/`) кладёт лендос рядом с SPA.
