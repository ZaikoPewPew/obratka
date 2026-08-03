# `src/assets/` — ассеты для импорта из кода

Файлы, которые подключаются через `import` в JS-модулях (не через URL из `public/`).

## `home/`

Чипы / иконки шапки и карточек ленты (`bone.svg`, `reputation-*.svg`, `plus.svg` для CTA «Закинуть», `feedback.svg` paper plane для FAB feedback, `report-sent.svg` для статуса «Отчёт отправлен», …).
`reputation-*.svg` — inline через `?raw` (группа `.home-screen__reputation-eyes` для анимации взгляда на чипе; в топ-50 на вкладке «Рейтинг» — те же SVG статично, без idle-loop).
`plus.svg` / `feedback.svg` / `report-sent.svg` — inline через `?raw` (`currentColor`).
`report-sent.svg` — галочка в сером превью карточки сегмента «Уже отревьюено» (`--home-screen-card-reviewed-icon-color` → `--color-success`).

### `home/modal/`

Ассеты тел модалок (explainers): PNG + общий Lottie.  
**Как юзать (размеры, цвет `#F3F4F7`, sync):** [`home/modal/README.md`](home/modal/README.md).

| Файл | Роль |
|------|------|
| `currency-duck.png` | фото в explainer «Уточки» (поверх Lottie, 552×268) |
| `currency-duck-leave.png` | фото в confirm «Прервать ревью?» на `/review` (поверх Lottie, 552×268) |
| `currency-referal.png` | фото в invite-explainer (поверх Lottie на `#F3F4F7`) |
| `currency-empty-duck.png` | фото в mine not-ready explainer (поверх Lottie на `#F3F4F7`) |
| `balance-card-ducks.svg` | legacy-декор (не используется) |
| `currency-ghost.png` | фото в explainer «Репутация» (поверх Lottie, 552×268) |
| `currency-p2p.png` | фото в explainer «p4p в сети» (поверх Lottie, 552×268) |
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
| `primer_not_iframe.mp4` | инструкция в external UI на `/review` (`.iframe-shell__external-media`, autoplay/loop/muted) |
| `welcome.mp4` | шаг video онбординга (4 из 4) |
| `icon-play.svg` / `icon-pause.svg` / `icon-sound.svg` / `icon-mute.svg` / `icon-play-compact.svg` / `icon-pause-compact.svg` | контролы [`VideoPlayerCard`](../components/video-player-card/README.md) |

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
