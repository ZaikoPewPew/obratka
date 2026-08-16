# Landing (промо)

Отдельный Vite entry: свой HTML/CSS/JS. Без `src/api/*`, session, Supabase, claims.

Prod: https://obratka.net/landing/  
Карта продукта: [`SCREENS.md`](../SCREENS.md). Структура: [`STRUCTURE.md`](../STRUCTURE.md).

## Локально

```bash
npm run dev
```

Открыть: [http://localhost:5173/landing/](http://localhost:5173/landing/)

## Блоки

Полноэкранные панели (`scroll-snap`):

1. **Hero** — польза («готово ли портфолио») + описание + CTA «Попробовать сервис» + стек аватаров  
2. **Question** — готово ли портфолио (акцент «готово»)  
3. **Pain** — часы на исправления (акцент «Ты тратишь часы»)  
4. **Bridge** — «замерить?» (акцент)  
5. **Community** — «Обратка — это сообщество…» (акцент «честную обратную связь»)  
6. **Demo** — только видео **833×478** (`#how`, меню «Как это работает»)  
7. **Price** — «Это бесплатно» / три чужих ревью → слот (`#price`, меню «Цена»)  
8. **Closing** — «Хватит править портфолио вслепую» / «Забирай реферальный код» + CTA «В сообщество» (Telegram)  
9. **FAQ** — последний блок (`#faq`)  

Шапка sticky: логотип + якоря (Как это работает / Цена / FAQ) + «Войти».  
Footer: © + «Сообщество» (Telegram) + «Правила» / «Политика» / «Соглашение» (один side-panel из `rules.json` / `privacy.json` / `terms.json`).  
Типографика: title `32 / semibold`, body `16 / 1.7`.

## Motion

- `scroll-snap-type: y mandatory` + `scroll-snap-stop: always` на панелях (FAQ — `snap-align: start`).  
- Demo — `IntersectionObserver` + `motion-reveal-scale`.  
- Заголовки / copy — word reveal (GSAP play/reverse при входе/уходе): `data-landing-scroll-reveal` → [`landing/src/scrollReveal.js`](src/scrollReveal.js).  
- `prefers-reduced-motion: reduce` — без snap / CSS reveal / GSAP.

## CTA

В шапке — **«Войти»**; в hero — **«Попробовать сервис»** (`data-landing-cta`). Href через `import.meta.env.BASE_URL` / invite gate:

| Условие | Куда |
|---------|------|
| `?ref=` в URL лендоса | `/referral?ref=…` |
| `obratka.inviteGatePassed` (уже вводили код на этом устройстве) | `/registration` |
| иначе | `/referral` |

Closing «В сообщество» и футер «Сообщество» — [t.me/obratka_dsgn](https://t.me/obratka_dsgn), без перезаписи.  
Читаем `getInviteGatePassed` — не пишем в gate / session.

## Изоляция

| Можно | Нельзя |
|-------|--------|
| Токены `--landing-*`, `createVideoPlayerCard`, `createSidePanel`, `getLegalDoc` / `fillSidePanelDoc`, `fixHangingPrepositions`, `gsap` (только лендос), фасад аналитики, `founder-avatars.json` | `src/api/*`, `src/main.js`, `src/app/session.js` |
| Читать `inviteGatePassed`; CTA → `/referral` / `/registration` | Писать в `obratka.session` / invite gate |
| Свои строки в HTML (не `locales.json`); демо из `src/assets/video/` | Монтировать продуктовые экраны |

Копирайт лендоса **не** в `content/locales.json` — статичный HTML + `data-fix-hanging`.

## Файлы

| Путь | Роль |
|------|------|
| `landing/index.html` | Разметка |
| `landing/src/main.js` | CTA, hanging, demo, FAQ, rules side-panel, reveal, analytics |
| `landing/src/proofAvatars.js` | Стек аватаров hero (unavatar + `founder-avatars.json`) |
| `landing/src/scrollReveal.js` | Word-by-word GSAP ScrollTrigger |
| `landing/styles/landing.css` | Стили (только `var(--landing-*)` / семантика) |
| `styles/tokens.css` | `--landing-*` (demo, FAQ, nav, proof, scroll-reveal) |
| `src/components/video-player-card/` | Плеер showcase |

## SEO (фаза 1)

- `index, follow` + `canonical` + OG/Twitter в [`landing/index.html`](index.html).
- Абсолютные URL: плейсхолдеры `%SITE_ORIGIN%` / `%SITE_BASE%` → `vite.config.js` (`transformIndexHtml`).
- Картинка шаринга: [`public/assets/og/og-share.png`](../public/assets/og/og-share.png).
- Crawl: [`public/robots.txt`](../public/robots.txt) + [`public/sitemap.xml`](../public/sitemap.xml) (только лендос). SPA — `noindex` в корневом `index.html`.

## Сборка / Pages

`vite.config.js` → MPA input `landing` → `dist/landing/index.html`.  
`npm run build` (CI с `VITE_BASE_PATH=/` для `obratka.net`) кладёт лендос рядом с SPA.
