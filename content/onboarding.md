# Онбординг — контент вопросов

Источник шагов: `content/onboarding.json`.  
UI-кнопки и прогресс: ключи `onboarding*` в `locales.json`.  
Рендер: `src/components/onboarding-screen/OnboardingScreen.js`.

## Схема `onboarding.json`

```json
{
  "version": 1,
  "steps": [
    {
      "id": "role",
      "type": "single",
      "hidden": true,
      "labelKey": "onboardingStepRoleLabel",
      "options": [
        { "value": "designer", "labelKey": "onboardingStepRoleDesigner" }
      ]
    }
  ]
}
```

| Поле | Тип | Смысл |
|------|-----|--------|
| `version` | number | Версия схемы (миграции ответов) |
| `steps[].id` | string | Стабильный id ответа |
| `steps[].type` | `single` \| `multi` \| `text` | Тип вопроса |
| `steps[].labelKey` | string | Ключ заголовка в locales |
| `steps[].options` | array? | Для single/multi: `value` + `labelKey` |
| `steps[].required` | boolean? | Default `true` |
| `steps[].hidden` | boolean? | Не показывать в UI; ответ всё равно пишется в профиль |

Тексты вариантов и лейблов — **только** через `labelKey` → `locales.json` (ru/en), не строки в JSON.

## Текущие шаги (v2)

Порядок в UI: грейд → домен → ожидания. Шаг `role` в JSON есть, но **`hidden: true`**.

| # | `id` | `type` | В UI? | Смысл |
|---|------|--------|-------|--------|
| — | `role` | single | нет (`hidden`) | Специализация; в профиль пишется `product-designer` (`DEFAULT_ONBOARDING_ROLE` в `src/api/onboarding.js`) |
| 1 | `grade` | single | да | Грейд (матчинг ревью / лиги) |
| 2 | `domain` | multi | да | Профиль / домен |
| 3 | `goal` | multi | да | Ожидания от платформы |

## Связь с экраном

Левая панель onboarding-screen читает видимые `steps` по порядку; правая — brand visual без изменений. `single` — radio + auto-advance; `multi` — checkbox + «Далее» / «Начать».

Подробнее: [`onboarding-screen/README.md`](../src/components/onboarding-screen/README.md).  
События воронки (wired + план): [`ANALYTICS.md`](../ANALYTICS.md).
