# `src/assets/` — ассеты для импорта из кода

Файлы, которые подключаются через `import` в JS-модулях (не через URL из `public/`).

## `home/`

Чипы / иконки шапки и карточек ленты (`bone.svg`, `reputation-*.svg`, `plus.svg` для CTA «Закинуть», `feedback.svg` для FAB feedback, …).
`reputation-*.svg` — inline через `?raw` (группа `.home-screen__reputation-eyes` для анимации взгляда).
`plus.svg` / `feedback.svg` — inline через `?raw` (currentColor).

### `home/modal/`

Ассеты тел модалок на главной (explainer’ы и т.п.):

| Файл | Роль |
|------|------|
| `currency-duck.png` | фото в explainer «Валюта сообщества» |
| `currency-referal.png` | фото в invite-explainer (поверх Lottie на `#F3F4F7`) |
| `currency-empty-duck.png` | фото в mine not-ready explainer (поверх Lottie на `#F3F4F7`) |
| `balance-card-ducks.svg` | декор карточки «Уточки» |
| `currency-ghost.png` | фото в explainer «Репутация в нашей обратке» |
| `currency-p2p.png` | фото в explainer «p4p в сети» |
| `rotating-ray.json` | Lottie-лучи под PNG в explainer-медиа |

## `brand/`

| Файл | Роль |
|------|------|
| `logo.svg` | полный логотип (компонент logo / legacy) |
| `mark.svg` | default blob **44×43** — правый visual brand-экранов |
| `mark-ban.svg` | evil: flame + blob **44×52** (ban-screen; путь flame для морфа) |
| `logo-done.svg` | success / done: blob + корона + крылья |
| `logoDonePaths.js` | path-строки для in-place morph → done |
| `brandMarks.js` | фабрики SVG + morph API |

## `audio/`

| Файл | Роль |
|------|------|
| `Timer-end.wav` | звук окончания таймера просмотра на `/review` (`main.js`) |

## `video/`

| Файл | Роль |
|------|------|
| `primer.mp4` | пример ревью в intro-модалке home (`homeReviewIntro*`, autoplay/loop/muted) |

### `brandMarks.js` — API

| Функция | Когда |
|---------|--------|
| `brandMarkSvg(className)` | default mark (data-brand-mark=`default`) |
| `banBrandMarkSvg(className?)` | статичный evil для ban-screen (полный 44×52) |
| `logoDoneMarkSvg(className)` | статичный done |
| `morphBrandMarkToEvil(svg, opts?)` | рожки fade-in **без** смены width/height/viewBox |
| `morphBrandMarkToDefault(svg, opts?)` | рожки fade-out |
| `morphBrandMarkToDone(svg, opts?)` | default → logo-done (размеры меняются) |
| `resetBrandMarkToDefault(svg)` | мгновенный snap к default |

Обычный путь на brand-экранах: не вызывать morph вручную, а  
`createBrandScreenVisual().setVariant("invalid"|"default"|"done")`  
→ внутри вызываются эти функции. См. [`brand-screen-visual/README.md`](../components/brand-screen-visual/README.md).

### Evil без resize

Flame из ban-ассета кладётся поверх default blob с `translate(0, −9)` (разница canvas 52 vs 43).  
CSS mark остаётся `--url-screen-brand-width/height`. Overflow: `visible` на mark/brand.
