# `brand-screen-visual` — правый visual brand-экрана

Общий блок **mesh + noise + бренд-марка** для split-экранов (referral / auth / auth-code / url / shell).  
Не знает про флоу и URL — только рисует правую колонку и умеет менять **вариант** (палитра + лого).

Файл: [`BrandScreenVisual.js`](BrandScreenVisual.js).

## Зачем

Раньше каждый экран копипастил `.url-screen__visual` / `__glow` / `__noise` / `__brand` и сам вызывал morph + `transitionToCssColors`.  
Теперь один компонент + `setVariant(...)`.

## API

```js
import { createBrandScreenVisual } from "../brand-screen-visual/BrandScreenVisual.js";

const visual = createBrandScreenVisual({
  classPrefix: "url-screen",           // классы `__visual`, `__glow`, …
  markClassName: "url-screen__brand-mark",
  withBrandSlot: false,                // true на UrlScreen (preview / done align)
  markPending: false,                  // true в shell: SVG вставляет consumer
});

visual.bindScreenRoot(screenSection);  // обязательно до setVariant
visual.setActive(true);                // mesh speed on/off (через meshWash)
visual.setVariant("default" | "invalid" | "done");
```

### Возвращаемое значение

| Поле | Тип | Роль |
|------|-----|------|
| `root` | `HTMLElement` | `.…__visual` — вешать в layout справа |
| `glow` | `HTMLElement` | контейнер WebGL mesh |
| `brand` | `HTMLElement` | `.…__brand` |
| `brandSlot` | `HTMLElement` | = `brand` или `.…__brand-slot` |
| `meshWash` | object | `mountMeshGradientWash(glow)` |
| `bindScreenRoot(el)` | fn | куда вешать `--invalid` / `--done` (`section`) |
| `setActive(bool)` | fn | `meshWash.setActive` |
| `setVariant(v)` | fn | смена палитры + марки |
| `getVariant()` | fn | текущий variant |
| `getMarkSvg()` / `ensureMark()` | fn | SVG марки |

### Разметка

```text
visual.root
  glow          ← ShaderMount (meshGradientWash)
  noise
  brand
    [brand-slot?] ← SVG mark   (если withBrandSlot)
    SVG mark      ← иначе прямо в brand
```

Доп. узлы (preview на UrlScreen):

```js
visual.root.insertBefore(preview, visual.brand);
```

## Варианты (`setVariant`)

Классы вешаются на **screen root** (`section.url-screen`), не на `visual.root`.  
CSS читает их и подменяет `--url-screen-mesh-*` на glow; JS плавно интерполирует цвета.

| Variant | Класс на screen | Марка | Mesh tokens | Motion |
|---------|-----------------|-------|-------------|--------|
| `default` | снять `--invalid` / `--done` | default blob **44×43** | `--url-screen-mesh-1…4` | refresh / morph from evil |
| `invalid` | `url-screen--invalid` | **те же размеры**; рожки fade-in поверх blob | `--url-screen-error-mesh-*` (= ban) | `--motion-field-error-visual-*` |
| `done` | `url-screen--done` | logo-done (корона + крылья; **размеры меняются**) | `--shell-review-mesh-done-*` | brand-mark morph + mesh-done |

### `invalid` — без resize SVG

`morphBrandMarkToEvil` **не** меняет `width` / `height` / `viewBox`.  
Flame из `mark-ban.svg` сдвигается `translate(0, −9)` на canvas default (43), opacity 0→1.  
Обратно: `morphBrandMarkToDefault` гасит flame и удаляет path.

Ban-screen по-прежнему использует статичный полный `banBrandMarkSvg` (44×52) — там не морф.

### `done`

Как на UrlScreen / review: `morphBrandMarkToDone` + зелёный mesh.  
Приоритет CSS: `--done` сильнее `--invalid` (`.url-screen--invalid:not(.url-screen--done)`).

## Связь с ошибкой поля

```text
setError(true)
  → setUrlScreenFieldInvalid / setUrlScreenOtpInvalid   (текст + обводка)
  → visual.setVariant("invalid")                        (красный mesh + рожки)

setError(false)
  → field invalid off
  → visual.setVariant("default")
```

Модули поля: [`urlScreenField.js`](../../utils/urlScreenField.js), анимация текста — [`fieldError.js`](../../utils/fieldError.js).

Auth: outline только у email; provider-error — текст + тот же `invalid` visual (OR).

## Кто монтирует

| Экран / модуль | Как |
|----------------|-----|
| `brand-screen-shell` | обёртка для referral / auth / auth-code / onboarding / url |
| onboarding | shell `markPending: true`; SVG марки снаружи |
| url | shell `withBrandSlot: true` + preview |

Open/close mesh: `openBrandScreen` / `closeBrandScreen` через shell (`meshWash`).

## Токены

| Группа | Примеры |
|--------|---------|
| Default mesh | `--url-screen-mesh-1…4`, `--url-screen-visual-wash` |
| Error / ban | `--url-screen-error-mesh-*` → `--shell-ban-mesh-*` |
| Done | `--shell-review-mesh-done-*` |
| Mark size | `--url-screen-brand-width/height` (invalid **не** меняет) |
| Done mark size | `--url-screen-brand-done-*` |
| Motion invalid | `--motion-field-error-visual-duration/ease` |
| Motion done | `--shell-review-mesh-done-duration`, `--shell-review-brand-mark-morph-*` |

Источник: [`styles/tokens.css`](../../../styles/tokens.css).  
JS: [`motionTokens.js`](../../utils/motionTokens.js) — `getMotionFieldErrorVisual`, `getBrandMarkMorphMotion`, `getReviewMeshDoneMotion`.  
Morph API: [`brandMarks.js`](../../assets/brand/brandMarks.js).

## Не делать

- Не дублировать glow/noise/brand в экране, если уже есть visual.
- Не вешать `--invalid` / `--done` на `visual.root` — только на `section` через `bindScreenRoot`.
- Не хардкодить ms/цвета — только токены.
- Не менять размеры mark при `invalid` (рожки overflow).

См. [`brand-screen-shell/README.md`](../brand-screen-shell/README.md), [`SCREENS.md`](../../../SCREENS.md) § Visual.
