# `src/utils/` — утилиты

Лёгкие функции без тяжёлых зависимостей, которые используются в нескольких местах приложения.

## Состав

- `countTemplate.js` — вставка отформатированного числа в текстовый шаблон (`{count}`).
- `emailValidation.js` — валидация и нормализация email.
- `foundersCountDisplay.js` — обновление отображаемого числа подписчиков/основателей.
- `portfolioMeta.js` — нормализация URL портфолио; favicon (HTML → DDG → Google → `/favicon.ico`) и короткое имя сайта.
- `embedHosts.js` — каталог хостов: external-only + labels (см. `content/embed-hosts.md`).
- `portfolioEmbed.js` — стратегия показа URL: Figma/YouTube embed, iframe или внешняя вкладка.
- `meshGradientWash.js` — WebGL mesh-градиент (Paper Shaders) с палитрой из CSS-токенов.
- `portfolioEmbed.test.js` / `portfolioMeta.test.js` — фикстуры embed и meta (`npm test`).
- `reviewReport.js` — сводка ответов ревью → тексты трактовок для PDF.
- `shareReviewPdf.js` — печатный документ отчёта (сохранение как PDF).
