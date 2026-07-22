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

Тексты вариантов и лейблов — **только** через `labelKey` → `locales.json` (ru/en), не строки в JSON.

## Связь с экраном

Левая панель onboarding-screen читает `steps` по порядку; правая — brand visual без изменений. Навигация next/back — как у `ReviewPanel`.
