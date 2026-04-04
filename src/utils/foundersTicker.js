const STORAGE_KEY = "memento.foundersTicker";
const INITIAL = 123;
const STEP = 4;

/** Одно значение на загрузку страницы (несколько вызовов — то же число). */
let cachedPageValue = null;

function readAndBump() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (raw === null) {
      sessionStorage.setItem(STORAGE_KEY, String(INITIAL));
      return INITIAL;
    }
    const prev = parseInt(raw, 10);
    const next = (Number.isFinite(prev) ? prev : INITIAL) + STEP;
    sessionStorage.setItem(STORAGE_KEY, String(next));
    return next;
  } catch {
    return INITIAL;
  }
}

export function getFoundersTickerValue() {
  if (cachedPageValue !== null) {
    return cachedPageValue;
  }
  cachedPageValue = readAndBump();
  return cachedPageValue;
}

export function formatFoundersWaiting(template) {
  return String(template).replace(/\{foundersCount\}/g, String(getFoundersTickerValue()));
}
