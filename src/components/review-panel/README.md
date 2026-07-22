# `review-panel` — опросник ревью портфолио

Контент левой колонки `review-screen`: шаги вопросов, шкалы, чекбоксы, финальная отправка отчёта.

## Файл

- `ReviewPanel.js` — `createReviewPanel({ getPortfolioName?, onDoneChange? })` → `{ root, form, open, close, reset, focus }`.

## Шаги (8)

| # | Поле | UI |
|---|------|-----|
| 1 | `grade` | radio: junior → head (5) |
| 2 | `context` | слайдер 1–5 |
| 3 | `structure` | radio |
| 4 | `metrics` | radio |
| 5 | `visual` | слайдер 1–10 |
| 6 | `pain` | checkbox (до 6; «Всё ок» эксклюзивно) + «Продолжить» |
| 7 | `hire` | radio |
| 8 | `advice` | textarea, min 100 / max 1000 |

Auto-advance на одиночных radio/слайдерах; pain и advice — с кнопкой дальше / submit.

## Слайдер

Деления SVG + fill + thumb. Прогресс через rAF-lerp (`--shell-review-slider-lerp*`).  
Невидимый hit-area `--shell-review-slider-hit-size` (48px).  
ViewBox делений совпадает с `--shell-review-slider-width` / track-height в токенах.

## Финал (done)

После submit: email (`your@email.com`), «или поделитесь», Telegram / Скачать.  
Без автофокуса на инпут.  
`onDoneChange(true)` включает reveal PDF на `review-screen`.

Скачать → `shareReviewPdf`. Telegram → `t.me/share`. Email → `mailto:`.

## Ошибки шага

- По умолчанию: `reviewStepRequired`
- Advice: `reviewAdviceTooShort` (≥ 100 символов)

## i18n

Все строки — `content/locales.json` (`review*`, `report*`).  
Разметка: динамический текст через `getStrings()` / `formatString()`.

## Стили / токены

- `.review-panel*` в `styles/iframe-shell.css`
- `--shell-review-*` в `styles/tokens.css` (controls, slider, chips, done, report)

Связанные утилиты: `src/utils/reviewReport.js`, `shareReviewPdf.js`.
