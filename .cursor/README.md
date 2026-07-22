# Cursor — проект «Обратка»

Краткая карта для агента.

## Дизайн-система

| Что | Где |
|-----|-----|
| Токены (цвета, отступы, Montserrat, радиусы, motion, z-index, control-bar) | `styles/tokens.css` |
| Правило токенов | `.cursor/rules/design-tokens.mdc` |
| Локали ru/en (+ расширение) | `content/locales.json`, `src/i18n.js` |
| Правило i18n | `.cursor/rules/i18n.mdc` |
| Оболочка iframe + панель | `styles/iframe-shell.css`, `index.html`, `src/main.js` |
| Url-screen reveal (stagger) | токены `--url-screen-reveal-*`, keyframes в `iframe-shell.css` |
| Шрифт (self-host) | `@fontsource/montserrat` → импорт в `src/main.js` |

## Экраны (флоу)

| Что | Где |
|-----|-----|
| Архитектура экранов | `SCREENS.md` |
| Brand split-shell | `src/components/brand-screen-shell/` |
| Referral / auth / onboarding / home | `src/components/*-screen/` (каркас) |
| App flow + session | `src/app/` |
| Онбординг-контент | `content/onboarding.json`, `content/onboarding.md` |

Эталон visual для split-экранов: `url-screen` («Ссылка на портфолио»). Пока `main.js` монтирует только url-screen + iframe-сессию.

## Темы и языки

- Тема: `<html data-theme="dark">` (семантика в `tokens.css`)
- Язык: `?lang=en` / кнопка RU↔EN; default `ru`

## UI-сессия

- Таймер 1 минута → blur → закрытие iframe → модалка recall
- Портфолио: `https://janelle.page`
- Figma: «Обратка», панель `node-id=393-922`

## Исследования

| Что | Где |
|-----|-----|
| Опрос: дизайнеры и портфолио (2026) | `.cursor/research/designers-portfolio-2026.md` |
| Опросы: дизайн овчарка | `.cursor/research/design-ovcharka-polls.md` |
| Каталог встраивания площадок | `content/embed-hosts.md` |
