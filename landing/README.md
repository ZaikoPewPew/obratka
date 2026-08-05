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

Пять полноэкранных панелей (`scroll-snap`, по центру экрана):

1. **Intro** — title/body  
2. **Pain** — title / body / «Войти»  
3. **Demo** — одно видео **833×478** (`VideoPlayerCard`, `primer.mp4`)  
4. **Benefits** — grid 2×2 карточек (stagger при reveal панели)  
5. **Closing** — invite-only + CTA  

Шапка sticky; footer после панелей.  
Типографика: title `32 / semibold`, body `16 / 1.7`.

## Motion

- `scroll-snap-type: y mandatory` + `scroll-snap-stop: always` на панелях.  
- Reveal панели через `IntersectionObserver` (`landing-reveal--in`); первая — сразу.  
- Demo — `motion-reveal-scale`; остальное — `motion-reveal`.  
- Падающие уточки: **far** (blur, за контентом) — просто летят, без collide/grab; **mid** (в фокусе) — отскок от блоков и друг от друга + grab/throw.  
- `prefers-reduced-motion: reduce` — без snap/анимаций/уточек.

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
| Токены `--landing-*`, `createVideoPlayerCard`, `fixHangingPrepositions` | `src/api/*`, `src/main.js`, `src/app/session.js` |
| Читать `inviteGatePassed`; CTA → `/referral` или `/registration` | Писать в `obratka.session` / invite gate |
| Свои строки в HTML (не `locales.json`); демо из `src/assets/video/` | Монтировать продуктовые экраны |

Копирайт лендоса **не** в `content/locales.json` — статичный HTML + `data-fix-hanging`.

## Файлы

| Путь | Роль |
|------|------|
| `landing/index.html` | Разметка |
| `landing/src/main.js` | CTA, hanging, demo video, panel reveal |
| `landing/styles/landing.css` | Стили (только `var(--landing-*)` / семантика) |
| `styles/tokens.css` | `--landing-*` (demo 833×478, cards, reveal delays) |
| `src/components/video-player-card/` | Плеер showcase |

## SEO (фаза 1)

- `index, follow` + `canonical` + OG/Twitter в [`landing/index.html`](index.html).
- Абсолютные URL: плейсхолдеры `%SITE_ORIGIN%` / `%SITE_BASE%` → `vite.config.js` (`transformIndexHtml`).
- Картинка шаринга: [`public/assets/og/og-share.png`](../public/assets/og/og-share.png).
- Crawl: [`public/robots.txt`](../public/robots.txt) + [`public/sitemap.xml`](../public/sitemap.xml) (только лендос). SPA — `noindex` в корневом `index.html`.

## Сборка / Pages

`vite.config.js` → MPA input `landing` → `dist/landing/index.html`.  
`npm run build` (CI с `VITE_BASE_PATH=/obratka/`) кладёт лендос рядом с SPA.
