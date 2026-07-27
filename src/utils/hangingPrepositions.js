/**
 * Висячие предлоги / союзы: короткое слово (1–3 буквы) не остаётся
 * в конце строки — пробел после него → NBSP, чтобы уехать со следующим словом.
 *
 * @param {string} text
 * @returns {string}
 */
export function fixHangingPrepositions(text) {
  if (typeof text !== "string" || text.length === 0) return text;
  return text.replace(
    /(^|[\s\u00A0])(\p{L}{1,3})(\s+)(?=[\p{L}\p{N}«"„])/gu,
    (_match, before, word) => `${before}${word}\u00A0`,
  );
}
