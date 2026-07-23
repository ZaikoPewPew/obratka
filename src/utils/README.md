# `src/utils/` — утилиты

Лёгкие функции без тяжёлых зависимостей, которые используются в нескольких местах приложения.

## Состав

- `countTemplate.js` — вставка отформатированного числа в текстовый шаблон (`{count}`).
- `emailValidation.js` — валидация и нормализация email.
- `foundersCountDisplay.js` — обновление отображаемого числа подписчиков/основателей.
- `motionTokens.js` — чтение `--motion-*` из CSS для WAAPI / close-fallback (`getMotionReveal`, `getReportLaunchMotion`, `getReviewMeshDoneMotion`, `getScreenCloseFallbackMs`).
- `brandScreenTransition.js` — open/close split-экранов; `handoff` сохраняет правый visual без повторной анимации.
- `portfolioMeta.js` — нормализация URL портфолио; favicon (HTML → DDG → Google → `/favicon.ico`) и короткое имя сайта.
- `platformBrandIcon.js` — иконка площадки: Simple Icons (jsDelivr) для известных брендов, иначе favicon сайта.
- `embedHosts.js` — каталог хостов: external-only + labels (см. `content/embed-hosts.md`).
- `portfolioEmbed.js` — стратегия показа URL: Figma/YouTube embed, iframe или внешняя вкладка.
- `meshGradientWash.js` — WebGL mesh-градиент (Paper Shaders) с палитрой из CSS-токенов; `transitionToCssColors` для плавной смены.
- `portfolioEmbed.test.js` / `portfolioMeta.test.js` / `platformBrandIcon.test.js` — фикстуры embed, meta и brand-icon (`npm test`).
- Тесты роутов: `src/app/routes.test.js`.
- `reviewReport.js` — сводка ответов квиза → тексты для PDF.
- `shareReviewPdf.js` — печатный документ отчёта (PDF через print dialog).
