# `video-player-card` — кастомный видеоплеер

Figma: [VideoPlayerCard](https://www.figma.com/design/KhsEJRKjBaDm6xaj3zJh2s/?node-id=616-1409) (`616:1409`) — **340×602**.

## API

```js
createVideoPlayerCard({ src?, ariaLabel?, onEnded? }) → {
  root, setSrc(url), play(), pause(), destroy()
}
```

- `onEnded` — колбэк на нативный `ended` (один полный просмотр); онбординг открывает CTA «Начать».

## Возможности

- play / pause (центр play при паузе, во время playback скрыт; кнопка слева + клик по видео)
- mute / unmute
- scrub по прогресс-бару (pointer + клавиши)
- скорость: `1x` → `1.5x` → `2x` (цикл)
- прогресс во время playback — `requestAnimationFrame` (плавно), не редкий `timeupdate`
- нижний chrome: градиент + `backdrop-filter` blur с мягкой верхней кромкой (mask 0→100%), высота `--video-player-chrome-height`, прижат к низу карточки
- idle-hide: уход мыши → scrim fade + нижнее меню (chrome / scrub / кнопки) уезжает вниз (`--video-player-chrome-shift`); hover — въезд снизу вверх; idle `--video-player-chrome-idle` (0s); центр play — scale+fade по `--playing`

## Стили

`styles/video-player-card.css` + токены `--video-player-*` в `styles/tokens.css`.  
Иконки: `src/assets/video/icon-*.svg`.

## Где

Онбординг, шаг `type: "video"` (4 из 4) — [`onboarding-screen`](../onboarding-screen/README.md).
