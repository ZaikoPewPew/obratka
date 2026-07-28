# `src/utils/` — утилиты

Лёгкие функции без тяжёлых зависимостей, которые используются в нескольких местах приложения.

## Состав

| Файл | Роль |
|------|------|
| `plural.js` | склонение по числу (`one`/`few`/`many`/`other`) для i18n-шаблонов; реэкспорт из `src/i18n.js` |
| `hangingPrepositions.js` | висячие предлоги → `\u00A0` перед `textContent` (см. `typography.mdc`) |
| `countTemplate.js` | вставка отформатированного числа в шаблон (`{count}`) |
| `emailValidation.js` | валидация и нормализация email |
| `foundersCountDisplay.js` | число подписчиков/основателей |
| `motionTokens.js` | чтение `--motion-*` / cooldowns из CSS для WAAPI / таймеров |
| `brandScreenTransition.js` | open/close split-экранов; `handoff` без повторной анимации visual |
| `fieldError.js` | плавный выезд `.url-screen__error` (opacity/blur/высота) |
| `urlScreenField.js` | invalid поля: текст + aria + обводка (`--invalid` / OTP cells) |
| `portfolioMeta.js` | нормализация URL; favicon и имя сайта |
| `platformBrandIcon.js` | иконка площадки на карточке (Simple Icons / favicon / «www»); размер = 1/3 бейджа (`--home-screen-badge-platform-icon-size`); ≠≠** embed-стратегия |
| `embedHosts.js` | каталог хостов iframe vs новое окно (см. `content/embed-hosts.md`) |
| `portfolioEmbed.js` | Figma/YouTube embed / iframe / внешняя вкладка |
| `meshGradientWash.js` | WebGL mesh (Paper Shaders); `transitionToCssColors` |
| `reviewReport.js` | сводка квиза → тексты PDF (+ опц. `dictation`); зоны `contextZone` / `visualZone` (visual 1–5); вердикт `tier × gradeZone`. Спека: [`QUIZ.md`](../../QUIZ.md) |
| `shareReviewPdf.js` | печать PDF-отчёта (1 ревьюер = 1 страница; `onComplete`) |
| `referralCode.js` | нормализация referral-кода / URL |
| `inviteGate.js` | device flag `obratka.inviteGatePassed` после validate; переживает logout / `clearSession` |
| `backdropLuminance.js` | яркость фона под элементом (home tabbar → `--on-dark`; не ломать glass blur / entrance dock) |
| `homeRoute.js` | parse/build/canonical query для `/home`: `feed` / `mine` / `rating` и фильтр mine |
| `homeListCache.js` | SWR-кэш ленты home (`feed`/`mine`/`rating`, memory + `sessionStorage` `obratka.homeLists.<userId>`); `clearHomeListCache` на logout |
| `feedSeen.js` | seen id кейсов ленты для точки на «На ревью» (`localStorage` `obratka.feedSeen.<userId>`); открытие feed гасит; seed baseline; `clearFeedSeen` на logout |
| `mineReadySeen.js` | seen id готовых отчётов для точки на «Мои» / «Завершенные» (`localStorage` `obratka.mineReadySeen.<userId>`); открытие «Завершенные» гасит; `clearMineReadySeen` на logout |

Тесты: `*.test.js` рядом (в т.ч. `homeRoute.test.js`, `plural.test.js`, `hangingPrepositions.test.js`, `reviewReport.dictation.test.js`) + `src/app/routes.test.js` (`npm test`).

Движок надиктовки (не utils): [`src/lib/dictation/README.md`](../lib/dictation/README.md).

## Ошибки полей brand-экранов

Подробно: **[`FIELD_ERROR.md`](FIELD_ERROR.md)**.

Кратко: `setUrlScreenFieldInvalid` / `setUrlScreenOtpInvalid` + `createBrandScreenVisual().setVariant("invalid")`.

## Motion helpers (`motionTokens.js`)

CSS keyframes (SoT): `styles/entrance.css` — `motion-reveal` / `motion-reveal-scale` / `motion-reveal-topbar` / `motion-reveal-dock` / `motion-recording-blink` / `motion-reputation-eyes-look` / `motion-balance-duck-float` / `motion-control-error-buzz`.
Home dock entrance: только transform (`motion-reveal-dock`); delays — `--home-screen-reveal-delay-*`.
Home idle / haptic: уточка баланса (`motion-balance-duck-float`), глазки репутации, отказ CTA — класс `.motion-control-error-buzz`.

| Функция | Токены |
|---------|--------|
| `getMotionReveal` | `--motion-reveal-*` |
| `getScreenCloseFallbackMs` | `--motion-screen-close-fallback` |
| `getMotionFieldError` | `--motion-field-error-*` (текст ошибки) |
| `getMotionFieldErrorVisual` | `--motion-field-error-visual-*` (mesh + evil) |
| `getMotionControlErrorBuzz` | `--motion-control-error-buzz-*` (отказ CTA) |
| `getAuthCodeResendCooldownMs` | `--auth-code-resend-cooldown` |
| `getMotionAdvanceDelayMs` / `getMotionFocusDelayMs` | квиз |
| `getReportLaunchMotion` | уход PDF/preview-листа |
| `readSheetTranslateY` | вычисленный translateY листа (после CSS-clamp на короткой visual) |
| `getReviewMeshDoneMotion` / `getBrandMarkMorphMotion` | зелёный done + logo-done |

## Brand visual

Правый mesh/марка — не util, а компонент: [`brand-screen-visual`](../components/brand-screen-visual/README.md).  
Open/close: `brandScreenTransition.js` + `meshWash` с экрана.
