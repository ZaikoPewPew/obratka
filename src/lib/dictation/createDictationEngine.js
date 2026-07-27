import {
  createWebSpeechDictation,
  isWebSpeechSupported,
} from "./createWebSpeechDictation.js";

/**
 * Фабрика движка диктовки. Сейчас — Web Speech; позже можно вернуть Whisper
 * с тем же контрактом
 * (start/stop/onTranscript/onLevel/onWaveform/onError/setKeepAliveInBackground/resumeIfNeeded/destroy).
 *
 * @param {{ lang?: string; keepAliveInBackground?: boolean }} [options]
 * @returns {import("./createWebSpeechDictation.js").DictationEngine | null}
 */
export function createDictationEngine(options = {}) {
  if (!isWebSpeechSupported()) return null;
  return createWebSpeechDictation(options);
}

export { isWebSpeechSupported };
