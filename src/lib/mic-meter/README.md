# `src/lib/mic-meter/`

Лёгкий визуализатор микрофона для демо-UI (intro-модалка home).

- `getUserMedia` + `AnalyserNode` → `onWaveform(levels[])`
- **Без** SpeechRecognition, MediaRecorder, upload и текста
- Переиспользует `buildWaveformLevels` / `smoothWaveformLevels` из dictation

```js
import { createMicMeter, isMicMeterSupported } from "./createMicMeter.js";

const meter = createMicMeter();
meter.onWaveform((levels) => { /* set --control-rec-bar-level */ });
await meter.start();
await meter.stop();
meter.destroy();
```
