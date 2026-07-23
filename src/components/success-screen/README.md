# `success-screen` — экран успеха (пресеты)

Path: **`/done`**. Универсальный финал успешного действия (не часть quiz-workspace).

## Пресеты

| Id | Когда | CTA |
|----|--------|-----|
| `quizComplete` | после квиза | На главную / Следующий кейс → home |
| `portfolioSubmitted` | после подачи портфолио | На главную |
| `generic` | deep link / запасной | На главную |

Конфиг: `successPresets.js`. Копирайт: `success*` в `locales.json`.

## API

`createSuccessScreen({ onPrimary?, onSecondary? })` → `{ root, open, close }`

```js
successScreen.open({ preset: "quizComplete" });
```

Пресет в рантайме задаёт `main.js` (`pendingSuccessPreset`) перед `go("done")`.

## Стили

`styles/success-screen.css` + токены `--success-screen-*`.

См. [`SCREENS.md`](../../../SCREENS.md).
