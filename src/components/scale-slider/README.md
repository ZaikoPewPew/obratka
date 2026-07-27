# `scale-slider` — шкала оценки с сеткой

Слайдер для шагов квиза «понятность» / «визуал»: крупное однословное название критерия, трек с анимированной сеткой квадратов, прямоугольный thumb, подписи min/max слева/справа.

## API

`createScaleSlider({ name, from, to, title, ariaLabel?, ends: { low, high } })` → `HTMLElement` (`.review-panel__scale-block`).

- `title` — одно слово вида оценки (readout над треком).
- `ends.low` / `ends.high` — подписи минималки / максималки.
- Значения — целые стопы от `from` до `to` (step 1); drag и клавиатура магнитятся к ним.

## Поведение canvas

- Сетка ~6×6px, цвет из `color` трека (`--shell-review-slider-fill-color` / `currentColor`).
- «Хвост» до центра thumb + слабая «подсказка» справа при малых значениях.
- Пауза: `prefers-reduced-motion`, вне вьюпорта (`IntersectionObserver`), скрытая вкладка; `ResizeObserver` + `devicePixelRatio` ≤ 2.

Форма: скрытый `input[type=range].review-panel__slider-input` (как раньше) — `hasSliderValue` / FormData без изменений.

## Стили / токены

Классы `.review-panel__scale-*` / `.review-panel__slider-*` в `styles/iframe-shell.css`.  
Токены `--shell-review-slider-*` в `styles/tokens.css`.
