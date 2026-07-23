# Cursor — проект «Обратка»

Краткая карта для агента.

## Дизайн-система

| Что | Где |
|-----|-----|
| Токены | `styles/tokens.css` |
| Правило токенов | `.cursor/rules/design-tokens.mdc` |
| Локали ru/en | `content/locales.json`, `src/i18n.js` |
| Правило i18n | `.cursor/rules/i18n.mdc` |
| Правило экранов / флоу | `.cursor/rules/screens.mdc` |
| Оболочка iframe + квиз | `styles/iframe-shell.css`, `index.html`, `src/main.js` |
| Motion | `--motion-*`, `entrance.css`, `motionTokens.js`, `brandScreenTransition.js` |
| Шрифт | `@fontsource/montserrat` → `src/main.js` |

## Экраны и URL

Источник правды: [`SCREENS.md`](../SCREENS.md).

| Path | Экран |
|------|--------|
| `/referral` | Реферальный код (UI) |
| `/registration` | Регистрация (UI) |
| `/onboarding` | Онбординг (stub) |
| `/home` | Главная (stub) |
| `/portfolio` | Ссылка на портфолио (UI) |
| `/review` | Ревью: iframe + таймер |
| `/quiz` | Квиз |
| `/quiz/done` | Финал квиза |

| Что | Где |
|-----|-----|
| Routes / router / flow | `src/app/` |
| Brand split-shell | `src/components/brand-screen-shell/` |
| Referral / auth / onboarding / home / url | `src/components/*-screen/` |
| Квиз | `review-screen/` + `review-panel/` |
| Онбординг-контент | `content/onboarding.json`, `content/onboarding.md` |

Эталон split: `url-screen`. Соседние brand-экраны: `handoff` без анимации правого visual.  
Оркестрация: `main.js` → `go()` / `applyRoute()`.

## Темы и языки

- Тема: `<html data-theme="dark">` (семантика в `tokens.css`)
- Язык: `?lang=en` / кнопка RU↔EN; default `ru`

## Исследования

| Что | Где |
|-----|-----|
| Опрос: дизайнеры и портфолио (2026) | `.cursor/research/designers-portfolio-2026.md` |
| Опросы: дизайн овчарка | `.cursor/research/design-ovcharka-polls.md` |
| Каталог встраивания площадок | `content/embed-hosts.md` |
