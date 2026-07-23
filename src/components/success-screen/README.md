# `success-screen` — экран успеха (пресеты)

Path: **`/done`** (`success`). Только для **подачи своего портфолио** (и generic). Финал квиза — в `review-panel` на `/quiz/done`.

## Layout

Split: слева тайтл + кнопка в стиле «Выйти», справа зелёный mesh + brand (без листа — превью живёт на `url-screen`).

## Пресеты

| Id | Когда | CTA |
|----|--------|-----|
| `portfolioSubmitted` | после подачи портфолио | Выйти (`reviewDoneExit`) |
| `generic` | deep link / запасной | На главную |

Конфиг: `successPresets.js`. Копирайт: `success*` / `reviewDoneExit` в `locales.json`.

## API

`createSuccessScreen({ onPrimary?, onSecondary? })` → `{ root, open, close }`

```js
successScreen.open({ preset: "portfolioSubmitted" });
```

Пресет в рантайме задаёт `main.js` (`pendingSuccessPreset`) перед `go("success")`.

## Стили

`styles/success-screen.css` + токены `--success-screen-*`.

См. [`SCREENS.md`](../../../SCREENS.md).
