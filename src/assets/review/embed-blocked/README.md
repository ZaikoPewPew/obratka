# External review icons (embed-blocked)

Иконки шагов UI «портфолио нельзя во фрейме» на `/review` (Figma `574:2531`).

| Файл | Шаг |
|------|-----|
| `loading-2.svg` | Нажми «Открыть и начать» (лучи / loading) |
| `timer-2.svg` | Изучи портфолио |
| `music-note-1.svg` | Дождись сигнала |
| `list-check.svg` | Пройди опрос |

Разметка сейчас инлайнит те же path’ы в `index.html` (как mic/rec). Исходники здесь — SoT для повторного экспорта / будущей подмены.

Перед `/review` home intro греет Edge/Readymag probe (`onPreviewPortfolio` → `prefetchPortfolioEmbed`), чтобы external UI не мигал через broken iframe.

Видео-слот: `.iframe-shell__external-media` → `primer_not_iframe.mp4` (ширина 100%, overflow сверху по центру; play при external mode).
