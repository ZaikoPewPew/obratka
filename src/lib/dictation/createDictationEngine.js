import {
  createWebSpeechDictation,
  isWebSpeechSupported,
} from "./createWebSpeechDictation.js";

/**
 * Фабрика движка диктовки. Сейчас — Web Speech; позже можно вернуть Whisper
 * с тем же контрактом
 * (start/stop/onTranscript/onLevel/onWaveform/onError/destroy).
 *
 * @param {{ lang?: string }} [options]
 * @returns {import("./createWebSpeechDictation.js").DictationEngine | null}
 */
export function createDictationEngine(options = {}) {
  if (!isWebSpeechSupported()) return null;
  return createWebSpeechDictation(options);
}

export { isWebSpeechSupported };
