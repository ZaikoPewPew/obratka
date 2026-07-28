# `scale-slider` — шкала оценки с сеткой

Слайдер для шагов квиза **понятность** (`context`, 1–5) и **визуал** (`visual`, 1–5).

Над треком — заголовок в стиле вопросов квиза + приписка ступени; трек с анимированной сеткой квадратов; прямоугольный thumb; слева минималка, справа максималка.

Фабрика: [`ScaleSlider.js`](ScaleSlider.js). Подключается из [`review-panel`](../review-panel/README.md). Пул вопросов / зоны отчёта: [`QUIZ.md`](../../../QUIZ.md).

## API

```js
createScaleSlider({
  name,           // имя input (form → answers.context / answers.visual)
  from,           // min (целое)
  to,             // max (целое)
  title,          // idle-заголовок до первого касания («Понятность» / «Визуал»)
  description?,   // статичная приписка под заголовком (полный вопрос) — видна сразу
  ariaLabel?,     // полный вопрос для a11y
  ends: { low, high },
  valueTitles?,   // { [value]: string } — заголовок после touch
  valueHints?,    // { [value]: string } — приписка после touch (+ aria)
}) → HTMLElement  // .review-panel__scale-block
```

### Поведение текста

| Состояние | Заголовок | Приписка |
|-----------|-----------|----------|
| До touch | `title` (idle, напр. «Понятность») | сразу `description` (полный вопрос) — **без** `hidden` |
| Drag / pointer | `valueTitles[value]` сразу | `valueHints[value]` (меняется со ступенью) |
| Клавиатура | короткий кроссфейд заголовка | `valueHints[value]` |
| `reset-visual` | снова idle `title` | снова `description` |

Приписка видна с первого кадра, чтобы не появлялась при дёрге ползунка. До касания — дополнение к вопросу; после — контекст ступени.

Стопы — все целые от `from` до `to` (step 1). Drag и стрелки магнитятся к стопам; клавиши Home/End/PageUp/PageDown тоже по индексу стопов.

### Разметка

```text
.review-panel__scale-block
  ├─ .review-panel__scale-readout
  │    ├─ .review-panel__scale-readout-viewport
  │    │    └─ .review-panel__scale-readout-word
  │    └─ .review-panel__scale-readout-hint
  └─ .review-panel__scale-control
       ├─ .review-panel__slider
       │    ├─ .review-panel__slider-track
       │    │    ├─ canvas.review-panel__slider-canvas
       │    │    └─ .review-panel__slider-stops → .review-panel__slider-stop
       │    ├─ .review-panel__slider-thumb
       │    └─ input.review-panel__slider-input[type=range]
       └─ .review-panel__scale-ends → .review-panel__scale-end(+--high)
```

Форма: `input.review-panel__slider-input` — `hasSliderValue` / FormData без изменений. Сброс: `dispatchEvent(new Event("reset-visual"))`.

## Canvas-заливка

- Сетка ~6×6px (`--shell-review-slider-cell`), цвет из `color` трека (`--shell-review-slider-fill-color` → `currentColor`).
- «Хвост» мерцающих квадратов до центра thumb; слабая «подсказка» справа при малых значениях.
- Пауза анимации (CPU): `prefers-reduced-motion` (статичный кадр), вне вьюпорта (`IntersectionObserver`), скрытая вкладка (`visibilitychange`).
- Ресайз: `ResizeObserver` + `devicePixelRatio` ≤ 2; смена темы (`MutationObserver` на `<html>` class/style/`data-theme`) → перерисовка.

База — нативный `range` (не Radix): доступность, drag, keyboard уже в input.

## Стили / токены

Классы в `styles/iframe-shell.css`. Токены `--shell-review-slider-*` в `styles/tokens.css`:

| Токен | Назначение |
|-------|------------|
| `--shell-review-slider-readout-*` | заголовок (= вопрос квиза: 32px / regular / `--color-text`) |
| `--shell-review-slider-readout-gap` | отступ заголовок → слайдер (**24px** / `--space-6`) |
| `--shell-review-slider-hint-*` | приписка под заголовком |
| `--shell-review-slider-track-*` / `cell` / `fill-color` | трек и сетка |
| `--shell-review-slider-thumb-*` | прямоугольный ползунок |
| `--shell-review-slider-stop-*` | точки-стопы |
| `--shell-review-slider-title-*` | duration/shift/blur/ease кроссфейда (клавиатура) |
| `--shell-review-slider-lerp*` | сглаживание позиции thumb |

Типографика заголовка: `fixHangingPrepositions` перед `textContent`.

## i18n

| Ключи | Роль |
|-------|------|
| `reviewContextShort` / `reviewVisualShort` | idle-заголовок |
| `reviewContextLabel` / `reviewVisualLabel` | aria полного вопроса |
| `reviewContextScaleLow/High` / `reviewVisualScaleLow/High` | min/max (род согласован: «Слабый»–«Сильный») |
| `reviewContextValue1…5` / `reviewVisualValue1…5` | заголовок ступени |
| `reviewContextHint1…5` / `reviewVisualHint1…5` | приписка ступени |

Правило: `.cursor/rules/i18n.mdc`. Локали: `content/locales.json`.

## Связь с отчётом

Числа `context` / `visual` из FormData уходят в `answers` → зоны в [`reviewReport.js`](../../utils/reviewReport.js) (`contextZone` / `visualZone`) → тексты PDF.

Зоны **visual 1–5:** `1 → Weak`, `2 → Ok`, `3 → Good`, `4–5 → Strong` (см. [`QUIZ.md`](../../../QUIZ.md)).

Подписи слайдера — UX квиза; формулировки отчёта (`reportVisual*`) отдельные.

См. [`review-panel/README.md`](../review-panel/README.md), [`SCREENS.md`](../../../SCREENS.md).
