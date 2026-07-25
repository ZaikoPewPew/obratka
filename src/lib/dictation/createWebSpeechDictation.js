/**
 * DictationEngine на Web Speech API + AnalyserNode для уровней волны.
 * Контракт общий с будущим Whisper-бэкендом (start/stop/onTranscript/onLevel).
 */

/**
 * @typedef {{
 *   supported: boolean;
 *   start: () => Promise<boolean>;
 *   stop: () => Promise<void>;
 *   resetTranscript: () => void;
 *   onTranscript: (cb: (finalText: string, interim: string) => void) => () => void;
 *   onLevel: (cb: (level: number) => void) => () => void;
 *   onError: (cb: (code: string) => void) => () => void;
 *   destroy: () => void;
 * }} DictationEngine
 */

const BAR_TICK_MS = 50;
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

  let running = false;
  let wantRunning = false;
  let finalText = "";

  function emitTranscript(interim = "") {
    for (const cb of transcriptListeners) cb(finalText, interim);
  }

  function emitLevel(level) {
    const clamped = Math.max(0, Math.min(1, level));
    for (const cb of levelListeners) cb(clamped);
  }

  function emitError(code) {
    for (const cb of errorListeners) cb(code);
  }

  function stopLevelMeter() {
    if (levelTimer !== null) {
      window.clearInterval(levelTimer);
      levelTimer = null;
    }
    emitLevel(0);
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
    analyser.getByteTimeDomainData(levelBuffer);
    let sum = 0;
    for (let i = 0; i < levelBuffer.length; i += 1) {
      const v = (levelBuffer[i] - 128) / 128;
      sum += v * v;
    }
    const rms = Math.sqrt(sum / levelBuffer.length);
    return Math.min(1, rms * 4);
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
    levelTimer = window.setInterval(() => {
      emitLevel(readLevel());
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
      tearDownAudio();
      emitTranscript("");
    },

    resetTranscript() {
      finalText = "";
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

    onError(cb) {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },

    destroy() {
      wantRunning = false;
      void this.stop();
      transcriptListeners.clear();
      levelListeners.clear();
      errorListeners.clear();
    },
  };
}
