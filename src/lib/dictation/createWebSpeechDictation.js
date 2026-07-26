/**
 * DictationEngine на Web Speech API + AnalyserNode для уровней волны.
 * Контракт общий с будущим Whisper-бэкендом
 * (start/stop/onTranscript/onLevel/onWaveform).
 */

/**
 * @typedef {{
 *   supported: boolean;
 *   start: () => Promise<boolean>;
 *   stop: () => Promise<void>;
 *   resetTranscript: () => void;
 *   onTranscript: (cb: (finalText: string, interim: string) => void) => () => void;
 *   onLevel: (cb: (level: number) => void) => () => void;
 *   onWaveform: (cb: (levels: number[]) => void) => () => void;
 *   onError: (cb: (code: string) => void) => () => void;
 *   destroy: () => void;
 * }} DictationEngine
 */

const BAR_TICK_MS = 40;
const WAVEFORM_BAR_COUNT = 12;
/** Ниже — тишина; чуть ниже прежнего, чтобы шёпот не резался. */
const WAVEFORM_NOISE_FLOOR = 0.006;
/** Усиление RMS: обычная речь должна заполнять полосы без крика. */
const WAVEFORM_SENSITIVITY = 12;
/** < 1: тихий голос поднимается сильнее, громкий мягко упирается в 1. */
const WAVEFORM_CURVE = 0.62;
const WAVEFORM_LOCAL_MIX = 0.7;
/** EMA: быстрее вверх, медленнее вниз — меньше дёрганья. */
const WAVEFORM_SMOOTH_ATTACK = 0.48;
const WAVEFORM_SMOOTH_RELEASE = 0.16;
const MAX_ALTERNATIVES = 3;
const MIN_FINAL_CONFIDENCE = 0.4;

function normalizeTranscript(value) {
  return String(value || "")
    .replace(/\s+/gu, " ")
    .trim();
}

function comparableWord(value) {
  return value.toLocaleLowerCase().replace(/[.,!?;:…]+$/gu, "");
}

/**
 * RMS time-domain сегмента байтового буфера AnalyserNode.
 *
 * @param {Uint8Array} samples
 * @param {number} [start]
 * @param {number} [end]
 * @returns {number}
 */
export function timeDomainRms(samples, start = 0, end = samples?.length || 0) {
  const from = Math.max(0, Math.floor(start));
  const to = Math.min(samples?.length || 0, Math.floor(end));
  const count = Math.max(1, to - from);
  if (!samples?.length || to <= from) return 0;
  let squares = 0;
  for (let index = from; index < to; index += 1) {
    const value = (samples[index] - 128) / 128;
    squares += value * value;
  }
  return Math.sqrt(squares / count);
}

/**
 * Усиливает RMS до визуального уровня 0..1 с мягкой кривой:
 * тихая речь заметнее, громкая не упирается в потолок рывком.
 *
 * @param {number} rms
 * @returns {number}
 */
export function amplifyRms(rms) {
  const value = Number(rms);
  if (!Number.isFinite(value) || value <= 0) return 0;
  return Math.min(1, (value * WAVEFORM_SENSITIVITY) ** WAVEFORM_CURVE);
}

/**
 * Сглаживает сырые уровни полос (EMA): атака быстрее, спад медленнее.
 *
 * @param {number[]} current
 * @param {number[]} next
 * @param {{ attack?: number; release?: number }} [opts]
 * @returns {number[]}
 */
export function smoothWaveformLevels(current, next, opts = {}) {
  const attack =
    typeof opts.attack === "number" ? opts.attack : WAVEFORM_SMOOTH_ATTACK;
  const release =
    typeof opts.release === "number" ? opts.release : WAVEFORM_SMOOTH_RELEASE;
  const count = Math.max(current?.length || 0, next?.length || 0);
  /** @type {number[]} */
  const smoothed = new Array(count);
  for (let index = 0; index < count; index += 1) {
    const from = Number(current?.[index]) || 0;
    const to = Number(next?.[index]) || 0;
    const alpha = to > from ? attack : release;
    smoothed[index] = from + (to - from) * alpha;
  }
  return smoothed;
}

/**
 * Выбирает наиболее уверенную гипотезу, сохраняя fallback на первый вариант,
 * если браузер не сообщает confidence.
 *
 * @param {SpeechRecognitionResult | ArrayLike<SpeechRecognitionAlternative>} result
 * @returns {{ transcript: string; confidence: number | null } | null}
 */
export function selectSpeechAlternative(result) {
  if (!result || result.length < 1) return null;
  const alternatives = Array.from(
    { length: result.length },
    (_, index) => result[index],
  ).filter(Boolean);
  if (!alternatives.length) return null;
  const primaryConfidence =
    typeof alternatives[0].confidence === "number" &&
    Number.isFinite(alternatives[0].confidence) &&
    alternatives[0].confidence > 0
      ? alternatives[0].confidence
      : null;
  const withConfidence = alternatives.filter(
    (alternative) =>
      typeof alternative.confidence === "number" &&
      Number.isFinite(alternative.confidence) &&
      alternative.confidence > 0,
  );
  const selected = primaryConfidence !== null && withConfidence.length
    ? withConfidence.reduce((best, alternative) =>
        alternative.confidence > best.confidence ? alternative : best,
      )
    : alternatives[0];
  return {
    transcript: normalizeTranscript(selected.transcript),
    confidence:
      typeof selected.confidence === "number" &&
      Number.isFinite(selected.confidence) &&
      selected.confidence > 0
        ? selected.confidence
        : null,
  };
}

/**
 * Добавляет final-фрагмент без повторения хвоста после авто-restart.
 *
 * @param {string} current
 * @param {string} incoming
 * @returns {string}
 */
export function appendFinalTranscript(current, incoming) {
  const existing = normalizeTranscript(current);
  const next = normalizeTranscript(incoming);
  if (!existing) return next;
  if (!next) return existing;

  const existingWords = existing.split(" ");
  const nextWords = next.split(" ");
  const maxOverlap = Math.min(existingWords.length, nextWords.length);
  let overlap = 0;
  for (let size = maxOverlap; size >= 1; size -= 1) {
    const existingTail = existingWords
      .slice(-size)
      .map(comparableWord)
      .join(" ");
    const nextHead = nextWords.slice(0, size).map(comparableWord).join(" ");
    if (existingTail === nextHead && (size >= 2 || size === nextWords.length)) {
      overlap = size;
      break;
    }
  }
  return normalizeTranscript(
    [existing, nextWords.slice(overlap).join(" ")].filter(Boolean).join(" "),
  );
}

/**
 * Делит один временной аудиокадр на независимые сегменты-полосы.
 * Общий RMS добавляет цельную реакцию всей волне, локальный RMS сохраняет
 * индивидуальную высоту каждой полосы. Ниже noise floor возвращается тишина.
 *
 * @param {Uint8Array} samples
 * @param {number} [barCount]
 * @returns {number[]}
 */
export function buildWaveformLevels(
  samples,
  barCount = WAVEFORM_BAR_COUNT,
) {
  const count = Math.max(1, Math.floor(barCount));
  if (!samples?.length) return Array(count).fill(0);

  const overallRms = timeDomainRms(samples);
  if (overallRms < WAVEFORM_NOISE_FLOOR) return Array(count).fill(0);

  const globalLevel = amplifyRms(overallRms);
  /** @type {number[]} */
  const levels = new Array(count);
  for (let barIndex = 0; barIndex < count; barIndex += 1) {
    const start = Math.floor((barIndex * samples.length) / count);
    const end = Math.max(
      start + 1,
      Math.floor(((barIndex + 1) * samples.length) / count),
    );
    const localLevel = amplifyRms(timeDomainRms(samples, start, end));
    levels[barIndex] = Math.min(
      1,
      localLevel * WAVEFORM_LOCAL_MIX +
        globalLevel * (1 - WAVEFORM_LOCAL_MIX),
    );
  }
  return levels;
}

/**
 * @returns {boolean}
 */
export function isWebSpeechSupported() {
  if (typeof window === "undefined") return false;
  return Boolean(window.SpeechRecognition || window.webkitSpeechRecognition);
}

/**
 * @param {{ lang?: string }} [options]
 * @returns {DictationEngine}
 */
export function createWebSpeechDictation(options = {}) {
  const Recognition =
    typeof window !== "undefined"
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  /** @type {Set<(finalText: string, interim: string) => void>} */
  const transcriptListeners = new Set();
  /** @type {Set<(level: number) => void>} */
  const levelListeners = new Set();
  /** @type {Set<(levels: number[]) => void>} */
  const waveformListeners = new Set();
  /** @type {Set<(code: string) => void>} */
  const errorListeners = new Set();

  /** @type {SpeechRecognition | null} */
  let recognition = null;
  /** @type {MediaStream | null} */
  let mediaStream = null;
  /** @type {AudioContext | null} */
  let audioContext = null;
  /** @type {AnalyserNode | null} */
  let analyser = null;
  /** @type {Uint8Array | null} */
  let levelBuffer = null;
  /** @type {ReturnType<typeof window.setInterval> | null} */
  let levelTimer = null;
  /** @type {number[]} */
  let smoothedWaveform = Array(WAVEFORM_BAR_COUNT).fill(0);

  let running = false;
  let wantRunning = false;
  let finalText = "";
  /** Последний interim — на stop коммитим в final, иначе текст «пропадает». */
  let lastInterim = "";

  function emitTranscript(interim = "") {
    lastInterim = normalizeTranscript(interim);
    for (const cb of transcriptListeners) cb(finalText, lastInterim);
  }

  function emitLevel(level) {
    const clamped = Math.max(0, Math.min(1, level));
    for (const cb of levelListeners) cb(clamped);
  }

  function emitWaveform(levels) {
    for (const cb of waveformListeners) cb(levels);
  }

  function emitError(code) {
    for (const cb of errorListeners) cb(code);
  }

  function stopLevelMeter() {
    if (levelTimer !== null) {
      window.clearInterval(levelTimer);
      levelTimer = null;
    }
    smoothedWaveform = Array(WAVEFORM_BAR_COUNT).fill(0);
    emitLevel(0);
    emitWaveform(smoothedWaveform.slice());
  }

  function tearDownAudio() {
    stopLevelMeter();
    if (mediaStream) {
      for (const track of mediaStream.getTracks()) track.stop();
      mediaStream = null;
    }
    if (audioContext) {
      void audioContext.close().catch(() => {});
      audioContext = null;
    }
    analyser = null;
    levelBuffer = null;
  }

  function readLevel() {
    if (!analyser || !levelBuffer) return 0;
    return amplifyRms(timeDomainRms(levelBuffer));
  }

  async function startLevelMeter() {
    if (!navigator.mediaDevices?.getUserMedia) return;
    mediaStream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: false,
    });
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioContext = new Ctx();
    const source = audioContext.createMediaStreamSource(mediaStream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    levelBuffer = new Uint8Array(analyser.fftSize);
    smoothedWaveform = Array(WAVEFORM_BAR_COUNT).fill(0);
    levelTimer = window.setInterval(() => {
      analyser.getByteTimeDomainData(levelBuffer);
      if (levelListeners.size) emitLevel(readLevel());
      if (waveformListeners.size) {
        smoothedWaveform = smoothWaveformLevels(
          smoothedWaveform,
          buildWaveformLevels(levelBuffer),
        );
        emitWaveform(smoothedWaveform.slice());
      }
    }, BAR_TICK_MS);
  }

  function bindRecognition() {
    if (!Recognition) return null;
    const rec = new Recognition();
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = MAX_ALTERNATIVES;
    rec.lang = typeof options.lang === "string" && options.lang ? options.lang : "ru-RU";

    rec.onresult = (event) => {
      const interimPieces = [];
      const finalPieces = [];
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const result = event.results[i];
        const alternative = selectSpeechAlternative(result);
        if (!alternative?.transcript) continue;
        if (result.isFinal) {
          if (
            alternative.confidence !== null &&
            alternative.confidence < MIN_FINAL_CONFIDENCE
          ) {
            continue;
          }
          finalPieces.push(alternative.transcript);
        } else {
          interimPieces.push(alternative.transcript);
        }
      }
      if (finalPieces.length) {
        finalText = appendFinalTranscript(finalText, finalPieces.join(" "));
      }
      emitTranscript(normalizeTranscript(interimPieces.join(" ")));
    };

    rec.onerror = (event) => {
      const code = String(event.error || "speech_error");
      if (code === "aborted" || code === "no-speech") return;
      wantRunning = false;
      running = false;
      tearDownAudio();
      emitError(code === "not-allowed" ? "not_allowed" : code);
    };

    rec.onend = () => {
      running = false;
      if (wantRunning) {
        try {
          rec.start();
          running = true;
        } catch {
          wantRunning = false;
          tearDownAudio();
          emitError("speech_ended");
        }
      }
    };

    return rec;
  }

  return {
    supported: Boolean(Recognition),

    async start() {
      if (!Recognition) {
        emitError("unsupported");
        return false;
      }
      if (wantRunning) return true;
      wantRunning = true;
      finalText = finalText.trim();
      try {
        await startLevelMeter();
      } catch {
        wantRunning = false;
        tearDownAudio();
        emitError("not_allowed");
        return false;
      }
      if (!wantRunning) {
        tearDownAudio();
        return false;
      }
      recognition = bindRecognition();
      if (!recognition) {
        wantRunning = false;
        tearDownAudio();
        emitError("unsupported");
        return false;
      }
      try {
        recognition.start();
        running = true;
        return true;
      } catch {
        wantRunning = false;
        running = false;
        tearDownAudio();
        emitError("speech_start_failed");
        return false;
      }
    },

    async stop() {
      wantRunning = false;
      const rec = recognition;
      recognition = null;
      if (rec) {
        try {
          rec.onend = null;
          rec.onerror = null;
          rec.onresult = null;
          rec.stop();
        } catch {
          /* already stopped */
        }
      }
      running = false;
      // Interim ещё не в final — иначе UI теряет всё, что видел во время записи.
      if (lastInterim) {
        finalText = appendFinalTranscript(finalText, lastInterim);
        lastInterim = "";
      }
      tearDownAudio();
      emitTranscript("");
    },

    resetTranscript() {
      finalText = "";
      lastInterim = "";
      emitTranscript("");
    },

    onTranscript(cb) {
      transcriptListeners.add(cb);
      return () => transcriptListeners.delete(cb);
    },

    onLevel(cb) {
      levelListeners.add(cb);
      return () => levelListeners.delete(cb);
    },

    onWaveform(cb) {
      waveformListeners.add(cb);
      return () => waveformListeners.delete(cb);
    },

    onError(cb) {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },

    destroy() {
      wantRunning = false;
      void this.stop();
      transcriptListeners.clear();
      levelListeners.clear();
      waveformListeners.clear();
      errorListeners.clear();
    },
  };
}
