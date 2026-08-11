# `not-found-screen` — SPA 404

Минимальный экран «страница не найдена» для неизвестного path. Path: `/404` (`notFound`).

`dist/404.html` (= копия `index.html`) — **не** этот экран: это SPA-fallback для GitHub Pages deep links. Мусорный URL в приложении → `go("notFound")` → этот UI.

Карта: [`SCREENS.md`](../../../SCREENS.md).

## Layout

Белый фон + центрированные тайтл и одна кнопка. Без mesh / brand-split.

## Поведение (оркестрация в `main.js`)

| Триггер | Действие |
|---------|----------|
| Path не `/` и не в `ROUTE_PATHS` | `go("notFound", { replace: true })` → URL `/404` |
| Прямой `/404` | `applyRoute("notFound")` |
| CTA | `session.userId` → `go("home")`, иначе `go("auth")` (без invite gate → `/referral`) |
| Бан | `resolveAccessibleRoute` / `go` → `/banned` |

## Копирайт

| Ключ | RU | EN |
|------|----|----|
| `notFoundTitle` | Такой страницы нет | Page not found |
| `notFoundCta` | На главную | Go home |
| `metaTitleNotFound` | Обратка — страница не найдена | Obratka — page not found |

На `open()` — `document.title = metaTitleNotFound`. Висячие предлоги — `fixHangingPrepositions`. На `close()` — `applyDocumentI18n()`.

## API

```js
createNotFoundScreen({ onHome }) → { root, open, close }
```

Монтаж: `document.body.append(notFoundScreen.root)` в `main.js`.

## Стили / токены

- CSS: [`styles/not-found-screen.css`](../../../styles/not-found-screen.css)
- Токены: `--not-found-screen-*`
- Motion: fade `opacity` + `prefers-reduced-motion`
