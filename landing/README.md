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

1. **Шапка** — `logo.svg` (wordmark) + CTA «Войти»  
2. **Hero** — бренд, крупный заголовок, lead, CTA + mesh (`createBrandScreenVisual`, mark 44×49)  
3. **Showcase** — боль (title / lead / «Войти») + ряд из трёх `VideoPlayerCard` (без подложки)  
4. **Преимущества** — 4 пункта (лига, лист, таймер, репутация)  
5. **Закрытие** — invite-only + CTA  

Между блоками: `--landing-block-gap` (**128px**, как в Figma `/landing`).

## CTA

`data-landing-cta` → href через `import.meta.env.BASE_URL`:

| Условие | Куда |
|---------|------|
| `?ref=` в URL лендоса | `/referral?ref=…` |
| `obratka.inviteGatePassed` (уже вводили код на этом устройстве) | `/registration` |
| иначе | `/referral` |

Читаем `getInviteGatePassed` — не пишем в gate / session.

## Изоляция

| Можно | Нельзя |
|-------|--------|
| Токены `--landing-*`, `createBrandScreenVisual`, `createVideoPlayerCard`, `fixHangingPrepositions` | `src/api/*`, `src/main.js`, `src/app/session.js` |
| Читать `inviteGatePassed`; CTA → `/referral` или `/registration` | Писать в `obratka.session` / invite gate |
| Свои строки в HTML (не `locales.json`); демо-ролики из `src/assets/video/` | Монтировать продуктовые экраны |

Копирайт лендоса **не** в `content/locales.json` — статичный HTML + `data-fix-hanging` для висячих предлогов.

## Файлы

| Путь | Роль |
|------|------|
| `landing/index.html` | Разметка |
| `landing/src/main.js` | CTA href (invite gate), hanging prepositions, mesh visual, video cards |
| `landing/styles/landing.css` | Стили (только `var(--landing-*)` / семантика из `tokens.css`) |
| `styles/tokens.css` | `--landing-*` (в т.ч. block-gap 128) |
| `src/components/video-player-card/` | Плеер в карусели showcase |

## SEO (фаза 1)

- `index, follow` + `canonical` + OG/Twitter в [`landing/index.html`](index.html).
- Абсолютные URL: плейсхолдеры `%SITE_ORIGIN%` / `%SITE_BASE%` → `vite.config.js` (`transformIndexHtml`).
- Картинка шаринга: [`public/assets/og/og-share.png`](../public/assets/og/og-share.png).
- Crawl: [`public/robots.txt`](../public/robots.txt) + [`public/sitemap.xml`](../public/sitemap.xml) (только лендос). SPA — `noindex` в корневом `index.html`.

## Сборка / Pages

`vite.config.js` → MPA input `landing` → `dist/landing/index.html`.  
`npm run build` (CI с `VITE_BASE_PATH=/obratka/`) кладёт лендос рядом с SPA.
