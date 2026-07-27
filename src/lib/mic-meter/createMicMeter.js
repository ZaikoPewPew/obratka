/**
 * Лёгкий mic-meter: getUserMedia + AnalyserNode → уровни волны.
 * Без SpeechRecognition / записи / upload — только визуальная реакция на голос.
 */

import {
  buildWaveformLevels,
  smoothWaveformLevels,
} from "../dictation/createWebSpeechDictation.js";

const BAR_TICK_MS = 40;
const WAVEFORM_BAR_COUNT = 12;

/**
 * @returns {boolean}
 */
export function isMicMeterSupported() {
  return Boolean(
    typeof navigator !== "undefined" &&
      navigator.mediaDevices?.getUserMedia &&
      (window.AudioContext || window.webkitAudioContext),
  );
}

/**
 * @typedef {{
 *   supported: boolean;
 *   isRunning: () => boolean;
 *   start: () => Promise<boolean>;
 *   stop: () => Promise<void>;
 *   onWaveform: (cb: (levels: number[]) => void) => () => void;
 *   onError: (cb: (code: string) => void) => () => void;
 *   destroy: () => void;
 * }} MicMeter
 */

/**
 * @returns {MicMeter}
 */
export function createMicMeter() {
  /** @type {Set<(levels: number[]) => void>} */
  const waveformListeners = new Set();
  /** @type {Set<(code: string) => void>} */
  const errorListeners = new Set();

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
  let destroyed = false;

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

  async function start() {
    if (destroyed || running) return running;
    if (!isMicMeterSupported()) {
      emitError("unsupported");
      return false;
    }
    try {
      mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      const Ctx = window.AudioContext || window.webkitAudioContext;
      audioContext = new Ctx();
      if (audioContext.state === "suspended") {
        await audioContext.resume();
      }
      const source = audioContext.createMediaStreamSource(mediaStream);
      analyser = audioContext.createAnalyser();
      analyser.fftSize = 256;
      source.connect(analyser);
      levelBuffer = new Uint8Array(analyser.fftSize);
      smoothedWaveform = Array(WAVEFORM_BAR_COUNT).fill(0);
      levelTimer = window.setInterval(() => {
        if (!analyser || !levelBuffer) return;
        analyser.getByteTimeDomainData(levelBuffer);
        smoothedWaveform = smoothWaveformLevels(
          smoothedWaveform,
          buildWaveformLevels(levelBuffer),
        );
        emitWaveform(smoothedWaveform.slice());
      }, BAR_TICK_MS);
      running = true;
      return true;
    } catch (err) {
      tearDownAudio();
      running = false;
      const name = err && typeof err === "object" && "name" in err ? err.name : "";
      emitError(
        name === "NotAllowedError" || name === "PermissionDeniedError"
          ? "not_allowed"
          : "mic_error",
      );
      return false;
    }
  }

  async function stop() {
    running = false;
    tearDownAudio();
  }

  return {
    supported: isMicMeterSupported(),
    isRunning: () => running,
    start,
    stop,
    onWaveform: (cb) => {
      waveformListeners.add(cb);
      return () => waveformListeners.delete(cb);
    },
    onError: (cb) => {
      errorListeners.add(cb);
      return () => errorListeners.delete(cb);
    },
    destroy: () => {
      destroyed = true;
      running = false;
      tearDownAudio();
      waveformListeners.clear();
      errorListeners.clear();
    },
  };
}
