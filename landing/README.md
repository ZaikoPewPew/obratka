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

Шесть+ полноэкранных панелей (`scroll-snap`):

1. **Hook** — «нанимающие / 30 секунд» (акцент + кисточное подчёркивание)  
2. **Question** — готово ли портфолио (акцент «готово»)  
3. **Pain** — часы на исправления (акцент «Ты тратишь часы»)  
4. **Bridge** — «замерить?» (акцент)  
5. **Community** — «Обратка — это сообщество…» (акцент «честную обратную связь»)  
6. **Demo** — только видео **833×478**  
7. **Outcome** — 3 ревью + рекомендации (акцент «3 независимых ревью»)  
8. **Closing** — «Хватит править портфолио вслепую» / «Забирай реферальный код» + CTA «В сообщество»  
9. **FAQ** — последний блок страницы  

Шапка sticky; footer: © + «Сообщество» (Telegram) + «Правила» (side-panel из `rules.json`).  
Типографика: title `32 / semibold`, body `16 / 1.7`.

## Motion

- `scroll-snap-type: y mandatory` + `scroll-snap-stop: always` на панелях (FAQ — `snap-align: start`).  
- Demo — `IntersectionObserver` + `motion-reveal-scale`.  
- Заголовки / copy — word reveal (GSAP play/reverse при входе/уходе): `data-landing-scroll-reveal` → [`landing/src/scrollReveal.js`](src/scrollReveal.js).  
- `prefers-reduced-motion: reduce` — без snap / CSS reveal / GSAP.

## CTA

В шапке — **«Сообщество»**; в closing — **«В сообщество»** (`data-landing-cta`). Href через `import.meta.env.BASE_URL` / канал:

| Условие | Куда |
|---------|------|
| `?ref=` в URL лендоса | `/referral?ref=…` (внутри app) |
| `obratka.inviteGatePassed` (уже вводили код на этом устройстве) | `/registration` |
| иначе | [t.me/obratka_dsgn](https://t.me/obratka_dsgn) (`target=_blank`) — коды дропаются в канале |

Читаем `getInviteGatePassed` — не пишем в gate / session.

## Изоляция

| Можно | Нельзя |
|-------|--------|
| Токены `--landing-*`, `createVideoPlayerCard`, `createSidePanel`, `getCommunityRules`, `fixHangingPrepositions`, `gsap` (только лендос) | `src/api/*`, `src/main.js`, `src/app/session.js` |
| Читать `inviteGatePassed`; CTA → Telegram / `/referral` / `/registration` | Писать в `obratka.session` / invite gate |
| Свои строки в HTML (не `locales.json`); демо из `src/assets/video/` | Монтировать продуктовые экраны |

Копирайт лендоса **не** в `content/locales.json` — статичный HTML + `data-fix-hanging`.

## Файлы

| Путь | Роль |
|------|------|
| `landing/index.html` | Разметка |
| `landing/src/main.js` | CTA, hanging, demo, FAQ, rules side-panel, reveal |
| `landing/src/scrollReveal.js` | Word-by-word GSAP ScrollTrigger |
| `landing/styles/landing.css` | Стили (только `var(--landing-*)` / семантика) |
| `styles/tokens.css` | `--landing-*` (demo, FAQ, scroll-reveal) |
| `src/components/video-player-card/` | Плеер showcase |

## SEO (фаза 1)

- `index, follow` + `canonical` + OG/Twitter в [`landing/index.html`](index.html).
- Абсолютные URL: плейсхолдеры `%SITE_ORIGIN%` / `%SITE_BASE%` → `vite.config.js` (`transformIndexHtml`).
- Картинка шаринга: [`public/assets/og/og-share.png`](../public/assets/og/og-share.png).
- Crawl: [`public/robots.txt`](../public/robots.txt) + [`public/sitemap.xml`](../public/sitemap.xml) (только лендос). SPA — `noindex` в корневом `index.html`.

## Сборка / Pages

`vite.config.js` → MPA input `landing` → `dist/landing/index.html`.  
`npm run build` (CI с `VITE_BASE_PATH=/obratka/`) кладёт лендос рядом с SPA.
