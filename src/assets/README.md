# `src/assets/` — ассеты для импорта из кода

Файлы, которые подключаются через `import` в JS-модулях (не через URL из `public/`).

## `home/`

Чипы / иконки шапки и карточек ленты (`bone.svg`, `reputation-*.svg`, `plus.svg` для CTA «Закинуть», `report-sent.svg` для статуса «Отчёт отправлен», …).
`reputation-*.svg` — inline через `?raw` (группа `.home-screen__reputation-eyes` для анимации взгляда на чипе; в топ-50 на вкладке «Рейтинг» — те же SVG статично, без idle-loop).
`plus.svg` / `report-sent.svg` — inline через `?raw` (`currentColor`).
`report-sent.svg` — галочка в сером превью карточки сегмента «Уже отревьюено» (`--home-screen-card-reviewed-icon-color` → `--color-success`).
FAB feedback — Lottie [`lottie/cap-lottie.json`](lottie/cap-lottie.json), не `feedback.svg`.

### `home/modal/`

Ассеты тел модалок (explainers): PNG + общий Lottie.  
**Как юзать (размеры, цвет `#F3F4F7`, sync):** [`home/modal/README.md`](home/modal/README.md).

| Файл | Роль |
|------|------|
| `currency-duck.png` | фото в explainer «Уточки» (поверх Lottie, 552×268) |
| `currency-duck-leave.png` | фото в confirm «Прервать ревью?» на `/review` (поверх Lottie, 552×268) |
| `currency-referal.png` | фото в invite-explainer (поверх Lottie на `#F3F4F7`) |
| `currency-empty-duck.png` | фото в mine not-ready explainer (поверх Lottie на `#F3F4F7`) |
| `currency-ghost.png` | фото в explainer «Репутация» (поверх Lottie, 552×268) |
| `currency-p2p.png` | фото в explainer «p4p в сети» (поверх Lottie, 552×268) |
| `rotating-ray.json` | Lottie-лучи под PNG в explainer-медиа |

## `brand/`

| Файл | Роль |
|------|------|
| `logo-default.svg` | default blob **44×49** — правый visual brand-экранов / landing header |
| `logo-devil.svg` | evil: horns + accents + blob **44×53** (ban-screen; horns для морфа) |
| `logo-angel.svg` | success / done: body + halo + accents **52×59** |
| `logoDonePaths.js` | path-строки для in-place morph → done (angel) |
| `brandMarks.js` | фабрики SVG + morph API |

## `audio/`

| Файл | Роль |
|------|------|
| `Timer-end.wav` | звук окончания таймера просмотра на `/review` (`main.js`) |

## `lottie/`

| Файл | Роль |
|------|------|
| `cap-lottie.json` | FAB feedback на home ([`feedback`](../components/feedback/README.md)) |

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
| `banBrandMarkSvg(className?)` | статичный evil для ban-screen (полный 44×53) |
| `logoDoneMarkSvg(className)` | статичный done (angel) |
| `morphBrandMarkToEvil(svg, opts?)` | рожки fade-in **без** смены width/height/viewBox |
| `morphBrandMarkToDefault(svg, opts?)` | рожки fade-out |
| `morphBrandMarkToDone(svg, opts?)` | default → logo-angel / logo-done class (размеры меняются) |
| `resetBrandMarkToDefault(svg)` | мгновенный snap к default |

Обычный путь на brand-экранах: не вызывать morph вручную, а  
`createBrandScreenVisual().setVariant("invalid"|"default"|"done")`  
→ внутри вызываются эти функции. См. [`brand-screen-visual/README.md`](../components/brand-screen-visual/README.md).

### Evil без resize

Horns из `logo-devil.svg` кладутся поверх default blob с `translate(0, −4)` (разница canvas 53 vs 49).  
CSS mark остаётся `--url-screen-brand-width/height`. Overflow: `visible` на mark/brand.
