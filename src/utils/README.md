# `src/utils/` — утилиты

Лёгкие функции без тяжёлых зависимостей, которые используются в нескольких местах приложения.

## Состав

| Файл | Роль |
|------|------|
| `countTemplate.js` | вставка отформатированного числа в шаблон (`{count}`) |
| `emailValidation.js` | валидация и нормализация email |
| `foundersCountDisplay.js` | число подписчиков/основателей |
| `motionTokens.js` | чтение `--motion-*` / cooldowns из CSS для WAAPI / таймеров |
| `brandScreenTransition.js` | open/close split-экранов; `handoff` без повторной анимации visual |
| `fieldError.js` | плавный выезд `.url-screen__error` (opacity/blur/высота) |
| `urlScreenField.js` | invalid поля: текст + aria + обводка (`--invalid` / OTP cells) |
| `portfolioMeta.js` | нормализация URL; favicon и имя сайта |
| `platformBrandIcon.js` | иконка площадки (Simple Icons / «W») |
| `embedHosts.js` | каталог хостов (см. `content/embed-hosts.md`) |
| `portfolioEmbed.js` | Figma/YouTube embed / iframe / внешняя вкладка |
| `meshGradientWash.js` | WebGL mesh (Paper Shaders); `transitionToCssColors` |
| `reviewReport.js` | сводка квиза → тексты PDF |
| `shareReviewPdf.js` | печать PDF-отчёта (1 ревьюер = 1 страница; `onComplete`) |
| `referralCode.js` | нормализация referral-кода / URL |

Тесты: `*.test.js` рядом + `src/app/routes.test.js` (`npm test`).

## Ошибки полей brand-экранов

Подробно: **[`FIELD_ERROR.md`](FIELD_ERROR.md)**.

Кратко: `setUrlScreenFieldInvalid` / `setUrlScreenOtpInvalid` + `createBrandScreenVisual().setVariant("invalid")`.

## Motion helpers (`motionTokens.js`)

| Функция | Токены |
|---------|--------|
| `getMotionReveal` | `--motion-reveal-*` |
| `getScreenCloseFallbackMs` | `--motion-screen-close-fallback` |
| `getMotionFieldError` | `--motion-field-error-*` (текст ошибки) |
| `getMotionFieldErrorVisual` | `--motion-field-error-visual-*` (mesh + evil) |
| `getAuthCodeResendCooldownMs` | `--auth-code-resend-cooldown` |
| `getMotionAdvanceDelayMs` / `getMotionFocusDelayMs` | квиз |
| `getReportLaunchMotion` | уход PDF/preview-листа |
| `getReviewMeshDoneMotion` / `getBrandMarkMorphMotion` | зелёный done + logo-done |

## Brand visual

Правый mesh/марка — не util, а компонент: [`brand-screen-visual`](../components/brand-screen-visual/README.md).  
Open/close: `brandScreenTransition.js` + `meshWash` с экрана.
