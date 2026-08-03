# `video-player-card` — кастомный видеоплеер

Figma: [VideoPlayerCard](https://www.figma.com/design/KhsEJRKjBaDm6xaj3zJh2s/?node-id=616-1409) (`616:1409`) — **340×602**.

## API

```js
createVideoPlayerCard({ src?, ariaLabel? }) → {
  root, setSrc(url), play(), pause(), destroy()
}
```

## Возможности

- play / pause (центр play↔pause + кнопка слева + клик по видео)
- mute / unmute
- scrub по прогресс-бару (pointer + клавиши)
- скорость: `1x` → `1.5x` → `2x` (цикл)
- нижний chrome: градиент + `backdrop-filter` blur под контролами

## Стили

`styles/video-player-card.css` + токены `--video-player-*` в `styles/tokens.css`.  
Иконки: `src/assets/video/icon-*.svg`.

## Где

Онбординг, шаг `type: "video"` (4 из 4) — [`onboarding-screen`](../onboarding-screen/README.md).
