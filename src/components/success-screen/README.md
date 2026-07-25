# `success-screen` — экран успеха (пресеты)

Path: **`/done`** (`success`). Запасной / deep-link экран после подачи портфолио. Основной submit остаётся на `url-screen` (`setVariant("done")` + `syncRoute("success")`); финал квиза — в `review-panel` на `/quiz/done`.

## Layout

Split: слева тайтл + кнопка «На главную», справа зелёный mesh + brand (без листа — превью живёт на `url-screen`).

## Пресеты

| Id | Когда | CTA |
|----|--------|-----|
| `generic` | deep link `/done`, `applyRoute("success")` | На главную (`successGenericPrimary`) |
| `portfolioSubmitted` | в `successPresets.js` (legacy); рантайм сейчас всегда `generic` | На главную |

Конфиг: `successPresets.js`. Копирайт: `success*` в `locales.json`.

## API

`createSuccessScreen({ onPrimary?, onSecondary? })` → `{ root, open, close }`

```js
successScreen.open({ preset: "generic" });
```

Пресет в рантайме: `main.js` (`pendingSuccessPreset`, по умолчанию `"generic"`) перед `applyRoute("success")` / open при deep link.

## Стили

`styles/success-screen.css` + токены `--success-screen-*`.

См. [`SCREENS.md`](../../../SCREENS.md), [`url-screen/README.md`](../url-screen/README.md).
