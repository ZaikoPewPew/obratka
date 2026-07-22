# `onboarding-screen` — онбординг

Вопросы профиля после регистрации. Визуально — тот же split, что у «Ссылка на портфолио».

## Визуал

| Сторона | Содержимое |
|---------|------------|
| Правая | Как у `UrlScreen` / `brand-screen-shell` (mesh + бренд) — **без изменений** |
| Левая | Вместо инпута: вопрос шага + варианты ответа + навигация (назад / далее) + прогресс |

Motion появления экрана — как у url-screen; смена шагов — отдельный лёгкий transition (при реализации).

## Файл

- `OnboardingScreen.js` — `createOnboardingScreen({ onComplete })` → `{ root, open, close }`.
- Статус: **каркас**, не монтируется из `main.js`.

## Данные

Шаги и тексты вопросов: [`content/onboarding.json`](../../../content/onboarding.json)  
Схема: [`content/onboarding.md`](../../../content/onboarding.md)

Кнопки/ошибки навигации — ключи `onboarding*` в `locales.json`.

## Поведение (план)

1. Один вопрос на шаг; required блокирует «Далее» (как в `ReviewPanel`).
2. На последнем шаге — `onComplete(answers)`.
3. Ответы можно дополнительно сохранить через будущий `src/api/onboarding.js`.

## Паттерны рядом

- Навигация/прогресс: `review-panel/ReviewPanel.js`
- Каркас: `brand-screen-shell`

См. [`SCREENS.md`](../../../SCREENS.md).
