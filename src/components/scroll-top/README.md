# `scroll-top` — кубик «наверх»

Кнопка 56×56 слева от FAB [`feedback`](../feedback/README.md) на `/home`. Не ссылка Telegram: сосед в том же углу, вылетает из персонажа влево при скролле ленты вниз.

## Поведение

- Скролл **вниз** по `.home-screen__body` (порог как у tabbar, 6px) → куб выезжает влево (`translateX` на `size + gap`, gap 12px). Без fade — только вылет. Между кубом и FAB — липкий мост (`scroll-top-goo.svg` 8×23, растянут на gap, `scaleX` 0→1 вместе с вылетом).
- Скролл **вверх** / верх ленты / нет overflow → уезжает обратно в персонажа (`pointer-events: none`, z ниже FAB).
- Клик → `onActivate` (home скроллит body наверх; smooth, кроме `prefers-reduced-motion`).
- Reduced motion: без transition, сразу слева от FAB.
- i18n: `homeScrollTopAria`.

## API

`createScrollTop({ onActivate? })` → `{ root, syncCopy, syncFromScroller, setVisible }`.

## Код

- JS: [`ScrollTop.js`](./ScrollTop.js)
- CSS: [`styles/scroll-top.css`](../../../styles/scroll-top.css)
- Токены: `--scroll-top-*`, `--motion-scroll-top-*` в [`styles/tokens.css`](../../../styles/tokens.css)
- Иконка: [`src/assets/home/scroll-top.svg`](../../assets/home/scroll-top.svg) (`?raw`, `currentColor`)
- Мост: [`src/assets/home/scroll-top-goo.svg`](../../assets/home/scroll-top-goo.svg) (`?raw`, `currentColor`)
