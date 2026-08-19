# `scroll-top` — кубик «наверх»

Кнопка 56×56 над FAB [`feedback`](../feedback/README.md) на `/home`. Не ссылка Telegram: сосед в том же углу, вылетает из персонажа вверх при скролле ленты вниз.

## Поведение

- Скролл **вниз** по `.home-screen__body` (порог как у tabbar, 6px) → куб выезжает вверх (`translateY` на `size + gap`, gap 8px). Без fade — только вылет.
- Скролл **вверх** / верх ленты / нет overflow → уезжает обратно в персонажа (`pointer-events: none`, z ниже FAB).
- Клик → `onActivate` (home скроллит body наверх; smooth, кроме `prefers-reduced-motion`).
- Reduced motion: без transition, сразу над FAB.
- i18n: `homeScrollTopAria`.

## API

`createScrollTop({ onActivate? })` → `{ root, syncCopy, syncFromScroller, setVisible }`.

## Код

- JS: [`ScrollTop.js`](./ScrollTop.js)
- CSS: [`styles/scroll-top.css`](../../../styles/scroll-top.css)
- Токены: `--scroll-top-*`, `--motion-scroll-top-*` в [`styles/tokens.css`](../../../styles/tokens.css)
- Иконка: [`src/assets/home/scroll-top.svg`](../../assets/home/scroll-top.svg) (`?raw`, `currentColor`)
