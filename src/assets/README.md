# `src/assets/` — ассеты для импорта из кода

Файлы, которые подключаются через `import` в JS-модулях (не через URL из `public/`).

## `brand/`

| Файл | Роль |
|------|------|
| `logo.svg` | полный логотип (компонент logo / legacy) |
| `mark.svg` | default blob **44×43** — правый visual brand-экранов |
| `mark-ban.svg` | evil: flame + blob **44×52** (ban-screen; путь flame для морфа) |
| `logo-done.svg` | success / done: blob + корона + крылья |
| `logoDonePaths.js` | path-строки для in-place morph → done |
| `brandMarks.js` | фабрики SVG + morph API |

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
