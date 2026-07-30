# Explainer-медиа: PNG + Lottie `rotating-ray`

Источник правды для слота картинки в app-modal explainers (home + abort на `/review`).

## Паттерн

1. Контейнер `position: relative` + `overflow: hidden` (ширина 100%, фиксированная высота).
2. Снизу: Lottie `rotating-ray.json` через [`createExplainerMediaRay()`](../../../components/home-screen/explainerMediaRay.js) (класс `.home-screen__explainer-media-ray`).
3. Сверху: PNG (класс `.home-screen__explainer-media-photo`, `object-fit: contain`).
4. После `modal.open()` — обязательно `ray.sync()` (resize + play; модалка стартует `hidden`).

Скорость анимации: **1/3** дефолта Lottie (`anim.setSpeed(1 / 3)` в фабрике).

## Размеры

| Токен / слот | Высота медиа | Размер лучей |
|---|---|---|
| Invite / mine-not-ready | **256px** | **155%** ширины контейнера, `height: auto`, `aspect-ratio: 1 / 1` |
| p4p / balance / reputation / abort | **268px** | те же **155%** + `aspect-ratio: 1 / 1` |
| Базовый `--home-screen-explainer-media-ray-size` | — | `210%` (fallback; у кейсов переопределён на 155%) |

Ассеты PNG готовятся под кадр **1104×536** (2× к 552×268). Abort (`currency-duck-leave`) и p4p/balance/reputation — один и тот же слот: токены abort алиасят `--home-screen-p2p-explainer-media-*`.

Новый кейс без plate → копировать CSS/токены **p2p**, не invent свои `%` / `px`.

## Цвет лучей

Исходный Lottie — **белый** градиент.

| Фон слота | Filter | Зачем |
|---|---|---|
| Белая модалка, **без** plate (p4p, Уточки, Репутация, Прервать ревью) | `var(--home-screen-explainer-media-ray-on-light-filter)` → визуально **`#F3F4F7`** (`--palette-gray-100`) | иначе белое на белом не видно |
| Plate `--palette-gray-100` (invite, mine-not-ready) | **без** filter | белые лучи читаются на серой подложке; filter в gray-100 сделал бы лучи невидимыми |

Токен цвета-цели: `--home-screen-explainer-media-ray-color` (= `--palette-gray-100`).  
Filter: `brightness(0) invert(95.3%)` — приближение к каналу R у `#F3F4F7` (243/255). **Не** крутить `invert(88%)` и прочие «мягкие серые» — только этот SoT.

## Ассеты

| Файл | Где |
|---|---|
| `rotating-ray.json` | общий Lottie под все explainers |
| `currency-duck.png` | Уточки |
| `currency-duck-leave.png` | Прервать ревью? (`/review`) |
| `currency-p2p.png` | p4p в сети |
| `currency-ghost.png` | Репутация |
| `currency-referal.png` | Пригласить (на plate gray-100) |
| `currency-empty-duck.png` | Отчёт ещё не готов (на plate gray-100) |

## Код

| Место | Роль |
|---|---|
| `explainerMediaRay.js` | фабрика Lottie |
| `HomeScreen.js` | invite / mine-not-ready / p2p / balance / reputation |
| `main.js` | abort review modal |
| `styles/tokens.css` | `--home-screen-*-explainer-media-*`, `--shell-abort-*`, ray filter |
| `styles/home-screen.css` / `iframe-shell.css` | разметка слота + override лучей |

Правило агента: [`.cursor/rules/explainer-media.mdc`](../../../../.cursor/rules/explainer-media.mdc).
