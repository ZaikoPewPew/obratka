# Каталог встраивания портфолио

Источник правды в коде: `src/utils/embedHosts.js` (+ резолвер `src/utils/portfolioEmbed.js`).

Сайты с `X-Frame-Options` / CSP `frame-ancestors` нельзя показать во iframe чужого домена. С GitHub Pages заголовки чужого ответа не прочитать (CORS) — опираемся на этот лист.

## Стратегия:

1. **Спец-embed** — переписать URL (Figma, YouTube) и грузить iframe.
2. **Нельзя** — сразу внешняя вкладка + UI в оболочке (суффиксы в `EXTERNAL_EMBED_HOSTS`).
3. **Можно / неизвестно** — пробуем iframe as-is; дополнительно:
   - HTML-probe маркеров Readymag (best-effort, CORS часто режет);
   - если iframe остаётся `about:blank` / error (XFO/CSP/сеть) → эскалация в external UI и сброс таймера до кнопки «Открыть и начать».

Безопасность iframe (`#portfolio-frame`): `sandbox` без `allow-top-navigation` (скрипты/формы/попапы разрешены; увод top-окна — нет), `referrerpolicy="no-referrer"`. URL при submit и при открытии `/review` — только `http(s)` (клиент `normalizePortfolioUrl` + RPC `submit_portfolio`).

## Спец-embed

| Площадка | Поведение |
|----------|-----------|
| Figma (`figma.com`, `embed.figma.com`) | → `embed.figma.com/…?embed-host=obratka` |
| YouTube (`youtube.com`, `youtu.be`, `m.youtube.com`) | → `youtube.com/embed/{id}` |

`figma.com` **не** в списке «Нельзя»: сначала rewrite.

## Нельзя (внешняя вкладка)

| Suffix | Label |
|--------|-------|
| `behance.net` | Behance |
| `dribbble.com` | Dribbble |
| `linkedin.com` | LinkedIn |
| `instagram.com` | Instagram |
| `facebook.com`, `fb.com` | Facebook |
| `twitter.com`, `x.com` | X |
| `pinterest.com` | Pinterest |
| `medium.com` | Medium |
| `notion.so`, `notion.site` | Notion |
| `docs.google.com`, `drive.google.com`, `sheets.google.com`, `slides.google.com`, `sites.google.com` | Google Docs / Sites |
| `miro.com` | Miro |
| `whimsical.com` | Whimsical |
| `adobe.com`, `portfolio.adobe.com`, `myportfolio.com` | Adobe / Adobe Portfolio |
| `uxfol.io` | UXfol.io |
| `readymag.com`, `readymag.website` | Readymag |
| `artstation.com` | ArtStation |
| `contra.com` | Contra |
| `framer.com`, `framer.website` | Framer |
| `webflow.com` | Webflow |
| `tilda.cc`, `tilda.ws` | Tilda |
| `pixpa.com` | Pixpa |
| `journoportfolio.com` | Journo Portfolio |
| `wixsite.com` | Wix |
| `weebly.com` | Weebly |
| `strikingly.com` | Strikingly |
| `bento.me` | Bento |
| `onuniverse.com` | Universe |
| `smugmug.com` | SmugMug |
| `vercel.app` | Vercel |
| `awwwards.com` | Awwwards |

Замечания:

- `webflow.com` / `tilda.cc` — редактор и маркетинг. `tilda.ws` — опубликованные проекты на поддомене Tilda (`X-Frame-Options: SAMEORIGIN`, проверено). Сайты на **своём домене** или `*.webflow.io` в этот список **не** входят.
- `*.framer.website` и `framer.com` режутся. **`*.framer.ai` — не режем** (iframe ок, проверено на `dsgn-thinking.framer.ai`). Кастомный домен Framer — тоже iframe OK.
- Широкий суффикс `adobe.com` намеренно ловит Adobe Portfolio / Express и соседние страницы Adobe. Опубликованные сайты на `*.myportfolio.com` — отдельная запись (не суффикс `adobe.com`).
- **Readymag на своём домене** (`oliviagrace.work` и т.п.) суффиксом не ловится: Edge `portfolio-embed-probe` (XFO/CSP) → external; CORS HTML-probe и `about:*` fallback — запасные. На `readymag.com` / `readymag.website` — сразу external. Chromium при XFO `DENY` даёт тот же `SecurityError`, что у живого iframe — без Edge детект blocked не срабатывает.
- `*.wixsite.com` / `*.pixpa.com` / `*.journoportfolio.com` — в external (заголовки / отчёт 2026-07).
- `*.vercel.app` — дефолтный CSP Vercel режет чужой iframe (report2); кастомный домен на Vercel — optimistic + fallback.
- Weebly / Strikingly / Bento / Universe / SmugMug / Google Sites — external (report2).
- **Не** режем по апексу: `wix.com`, `editorx.com`, `github.io`, `netlify.app`, `carrd.co` (optimistic; у хостингов заголовки может переопределить проект).
- Иконка площадки на карточке (`platformBrandIcon.js`) **не** равна embed-стратегии: бренд можно показать и при optimistic iframe (пример: `*.webflow.io`, `*.framer.ai`, Cargo / Format / Squarespace / Canva).
- **PDF** — не отдельный хост: прямой `.pdf` пробуем как iframe (браузерный просмотрщик). Drive/Dropbox уже в «Нельзя» или optimistic. Отдельный режим не нужен, пока нет массовых ссылок.

## Можно пробовать iframe

Не в blocklist (optimistic):

- **Dprofile** (`dprofile.ru`)
- **Framer на `*.framer.ai`**
- Cargo (`cargo.site`, `cargocollective.com`), Format, Carbonmade, Read.cv, Are.na, Semplice, Super, Dropfile и аналоги
- Squarespace, Carrd, Pixieset, Indexhibit, Elementor Cloud, Canva Sites (`*.my.canva.site`)
- GitHub Pages (`*.github.io`), Netlify (`*.netlify.app`) — заголовки задаёт проект; при блоке сработает iframe fallback. Same-origin кейс (app и портфолио на одном `user.github.io`) — iframe ок; детект blocked смотрит только `about:*`, не «readable location»
- Личные / кастомные домены (в т.ч. Tilda/Framer на своём домене; **Readymag на своём** уйдёт в external через probe/fallback)
- Опубликованный Webflow: `*.webflow.io`

Неизвестный хост → iframe. Если площадка режет framing (или сеть/антибот ломает фрейм), оболочка эскалирует в external UI.

## Проверено вручную (2026-07)

| Площадка | Результат | Решение |
|----------|-----------|---------|
| Свой / кастомный домен | iframe ок | optimistic |
| `*.framer.ai` | iframe ок | optimistic |
| `tilda.ws` | `SAMEORIGIN` | external |
| Readymag (`*.website` / `*.com`) | не открывается | external |
| Readymag custom (`oliviagrace.work`) | `XFO: DENY` | optimistic → probe/fallback → external |
| Pixpa / Journo / Wixsite | framing cut | external |
| Behance | не открывается | external |
| Dribbble | `SAMEORIGIN` (заголовки) | external |
| Notion | беда | external |
| Dropfile | iframe ок | optimistic |
