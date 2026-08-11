# `src/utils/` — утилиты

Лёгкие функции без тяжёлых зависимостей, которые используются в нескольких местах приложения.

## Состав

| Файл | Роль |
|------|------|
| `plural.js` | склонение по числу (`one`/`few`/`many`/`other`) для i18n-шаблонов; реэкспорт из `src/i18n.js` |
| `hangingPrepositions.js` | висячие предлоги → `\u00A0` перед `textContent` (см. `typography.mdc`) |
| `emailValidation.js` | валидация и нормализация email |
| `motionTokens.js` | чтение `--motion-*` / cooldowns из CSS для WAAPI / таймеров |
| `brandScreenTransition.js` | open/close split-экранов; `handoff` без повторной анимации visual |
| `fieldError.js` | плавный выезд `.url-screen__error` (opacity/blur/высота) |
| `urlScreenField.js` | invalid поля: текст + aria + обводка (`--invalid` / OTP cells) |
| `portfolioMeta.js` | нормализация URL; favicon и имя сайта |
| `platformBrandIcon.js` | иконка площадки на карточке (Simple Icons / favicon / «www»); размер = 1/3 бейджа (`--home-screen-badge-platform-icon-size`); ≠≠** embed-стратегия |
| `embedHosts.js` | каталог хостов iframe vs новое окно (см. `content/embed-hosts.md`) |
| `portfolioEmbed.js` | Figma/YouTube embed / iframe / внешняя вкладка; Readymag HTML-probe; детект blocked iframe |
| `meshGradientWash.js` | WebGL mesh (Paper Shaders); `transitionToCssColors` |
| `reviewReport.js` | сводка квиза → тексты PDF (+ опц. `dictation`); зоны `contextZone` / `visualZone` (visual 1–5); вердикт `tier × gradeZone`. Спека: [`QUIZ.md`](../../QUIZ.md) |
| `shareReviewPdf.js` | печать PDF-отчёта (1 ревьюер = 1 страница; `onComplete`) |
| `referralCode.js` | нормализация referral-кода / URL |
| `inviteGate.js` | device flag `obratka.inviteGatePassed` после validate; переживает logout / `clearSession` |
| `backdropLuminance.js` | яркость фона под элементом (home tabbar → `--on-dark`; не ломать glass blur / entrance dock) |
| `homeRoute.js` | parse/build/canonical query для `/home`: `feed` / `mine` / `rating`; `filter` (`active`/`completed`) на `feed` и `mine` (`?filter=completed` = «Уже отревьюено») |
| `homeListCache.js` | SWR-кэш ленты home (`feed`/`feedReviewed`/`mine`/`rating`, memory + `sessionStorage` `obratka.homeLists.<userId>`); UI-hit только непустой массив (`[]` → skeleton); `removeCachedHomeListItem` после успешного submit ревью (id из `feed`); полный `clearHomeListCache` только на logout |
| `feedSeen.js` | seen id кейсов open-ленты для точки на «Чужие посты» (`localStorage` `obratka.feedSeen.<userId>`); открытие feed гасит; seed baseline; `clearFeedSeen` на logout |
| `mineReadySeen.js` | seen id готовых отчётов для точки на «Мои» / «Завершенные» (`localStorage` `obratka.mineReadySeen.<userId>`); открытие «Завершенные» гасит; `clearMineReadySeen` на logout |
| `tabAttention.js` | мигание `document.title` + favicon при конце таймера ревью (если вкладка скрыта); стоп по `window` focus; ассет `/assets/svg/favicon_timer.svg` |
| `viewport.js` | desktop-only: `DESKTOP_MIN_WIDTH_PX` (=768), `isDesktopViewport`, `subscribeDesktopViewport` (`matchMedia`) — [`mobile.md`](../../mobile.md) |
| `aggregatePortfolioReviews.js` | агрегаты листов (counts / min–max / `adviceList`) для сводного PDF |
| `resolveActionCards.js` | majority → max 3 cards + attach `actionResources` по `covers` |
| `buildConsensusReport.js` | тексты сводки + локализованные action cards |
| `shareConsensusPdf.js` | print iframe сводного PDF (`/report`) |
| `complaintWindow.js` | окно жалобы 6ч от `completed_at` (зеркало SQL) |

Данные карточек: [`src/data/actionCards.json`](../data/actionCards.json) + [`actionResources.json`](../data/actionResources.json). SoT: [`ACTION_CARDS.md`](../../ACTION_CARDS.md).

Тесты: `*.test.js` рядом (в т.ч. `homeRoute.test.js`, `plural.test.js`, `hangingPrepositions.test.js`, `reviewReport.dictation.test.js`, `consensusActionCards.test.js`, `complaintWindow.test.js`) + `src/app/routes.test.js` (`npm test`).

Движок надиктовки (не utils): [`src/lib/dictation/README.md`](../lib/dictation/README.md).  
Post-edit пунктуации: [`src/api/dictationPolish.js`](../api/dictationPolish.js) → [`polish-dictation`](../../supabase/functions/polish-dictation/README.md) (**`POLISH_ENABLED = false`**).

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
| `getMotionNotification` | `--motion-notification-*` (toast slide + hold) |
| `getAuthCodeResendCooldownMs` | `--auth-code-resend-cooldown` |
| `getMotionAdvanceDelayMs` / `getMotionFocusDelayMs` | квиз |
| `getReportLaunchMotion` | уход PDF/preview-листа |
| `readSheetTranslateY` | вычисленный translateY листа (после CSS-clamp на короткой visual) |
| `getReviewMeshDoneMotion` / `getBrandMarkMorphMotion` | зелёный done + logo-angel |

## Brand visual

Правый mesh/марка — не util, а компонент: [`brand-screen-visual`](../components/brand-screen-visual/README.md).  
Open/close: `brandScreenTransition.js` + `meshWash` с экрана.
