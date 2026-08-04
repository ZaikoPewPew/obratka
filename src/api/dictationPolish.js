import { getSupabase, isSupabaseConfigured } from "../lib/supabaseClient.js";
import { getLocale } from "../i18n.js";

const DEFAULT_MAX_LEN = 4000;
const POLISH_TIMEOUT_MS = 14_000;
const MIN_LEN = 8;

/**
 * Kill-switch: Edge `polish-dictation` (Z.AI LLM) временно выключен —
 * иначе submit / «На главную» ждут invoke до ~14 s. Код и Function
 * сохранены: вернуть `true`, чтобы снова слать текст в LLM.
 */
const POLISH_ENABLED = false;

/**
 * Post-edit сырого транскрипта через Edge `polish-dictation` (Z.AI Flash).
 * При любой ошибке / таймауте / soft-fail Edge (`skipped`) возвращает
 * исходный текст — submit не блокируем.
 * При `POLISH_ENABLED === false` сразу возвращает исходный текст (без сети).
 *
 * @param {string} text
 * @param {{ maxLen?: number, locale?: string, timeoutMs?: number }} [opts]
 * @returns {Promise<string>}
 */
export async function polishDictationText(text, opts = {}) {
  const raw = typeof text === "string" ? text.trim() : "";
  const maxLen =
    typeof opts.maxLen === "number" && opts.maxLen > 0
      ? Math.floor(opts.maxLen)
      : DEFAULT_MAX_LEN;
  const sliced = raw.slice(0, maxLen);
  if (!sliced || sliced.length < MIN_LEN) return sliced;
  if (!POLISH_ENABLED) return sliced;
  if (!isSupabaseConfigured()) return sliced;

  const supabase = getSupabase();
  if (!supabase) return sliced;

  const locale =
    typeof opts.locale === "string" && opts.locale
      ? opts.locale
      : getLocale();
  const timeoutMs =
    typeof opts.timeoutMs === "number" && opts.timeoutMs > 0
      ? opts.timeoutMs
      : POLISH_TIMEOUT_MS;

  try {
    const invokePromise = supabase.functions.invoke("polish-dictation", {
      body: {
        text: sliced,
        locale,
        maxLen,
      },
    });
    const { data, error } = await Promise.race([
      invokePromise,
      new Promise((_, reject) => {
        window.setTimeout(() => reject(new Error("polish_timeout")), timeoutMs);
      }),
    ]);

    if (error) {
      if (import.meta.env.DEV) {
        console.warn("[dictationPolish]", error.message || error);
      }
      return sliced;
    }

    const polished =
      data && typeof data.text === "string" ? data.text.trim() : "";
    if (!polished) return sliced;
    return polished.slice(0, maxLen);
  } catch (err) {
    if (import.meta.env.DEV) {
      const message = err instanceof Error ? err.message : "polish_failed";
      console.warn("[dictationPolish]", message);
    }
    return sliced;
  }
}
