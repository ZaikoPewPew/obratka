# Каталог встраивания портфолио

Источник правды в коде: `src/utils/embedHosts.js` (+ резолвер `src/utils/portfolioEmbed.js`).

Сайты с `X-Frame-Options` / CSP `frame-ancestors` нельзя показать во iframe чужого домена. С GitHub Pages заголовки чужого ответа не прочитать (CORS) — опираемся на этот лист.

Стратегия:

1. **Спец-embed** — переписать URL (Figma, YouTube) и грузить iframe.
2. **Нельзя** — сразу внешняя вкладка + UI в оболочке.
3. **Можно / неизвестно** — пробуем iframe as-is (личные сайты, Dprofile и т.д.).

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
| `docs.google.com`, `drive.google.com`, `sheets.google.com`, `slides.google.com` | Google Docs |
| `miro.com` | Miro |
| `whimsical.com` | Whimsical |
| `adobe.com`, `portfolio.adobe.com` | Adobe |
| `uxfol.io` | UXfol.io |
| `readymag.com`, `readymag.website` | Readymag |
| `artstation.com` | ArtStation |
| `contra.com` | Contra |
| `framer.com`, `framer.website` | Framer |
| `webflow.com` | Webflow |
| `tilda.cc`, `tilda.ws` | Tilda |
| `awwwards.com` | Awwwards |

Замечания:

- `webflow.com` / `tilda.cc` — редактор и маркетинг. `tilda.ws` — опубликованные проекты на поддомене Tilda (`X-Frame-Options: SAMEORIGIN`, проверено). Сайты на **своём домене** или `*.webflow.io` в этот список **не** входят.
- `*.framer.website` и `framer.com` режутся. **`*.framer.ai` — не режем** (iframe ок, проверено на `dsgn-thinking.framer.ai`). Кастомный домен Framer — тоже iframe OK.
- Широкий суффикс `adobe.com` намеренно ловит Adobe Portfolio / Express и соседние страницы Adobe.
- **PDF** — не отдельный хост: прямой `.pdf` пробуем как iframe (браузерный просмотрщик). Drive/Dropbox уже в «Нельзя» или optimistic. Отдельный режим не нужен, пока нет массовых ссылок.

## Можно пробовать iframe

Не в blocklist (optimistic):

- **Dprofile** (`dprofile.ru`)
- **Framer на `*.framer.ai`**
- Cargo, Format, Are.na, Semplice, Super, Dropfile и аналоги
- Личные / кастомные домены
- Опубликованный Webflow: `*.webflow.io`
- Лендинги на Tilda/Framer **на кастомном домене**

Неизвестный хост → iframe. Если площадка всё же режет framing, пользователь увидит ошибку браузера; такие хосты стоит добавить в «Нельзя».

## Проверено вручную (2026-07)

| Площадка | Результат | Решение |
|----------|-----------|---------|
| Свой / кастомный домен | iframe ок | optimistic |
| `*.framer.ai` | iframe ок | optimistic |
| `tilda.ws` | `SAMEORIGIN` | external |
| Readymag | не открывается | external (уже было) |
| Behance | не открывается | external |
| Dribbble | `SAMEORIGIN` (заголовки) | external |
| Notion | беда | external |
| Dropfile | iframe ок | optimistic |
