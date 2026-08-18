/**
 * Промо MPA `/landing/`.
 * Выключено — продукт стартует с корня (`/` → referral / registration / home).
 * `/landing` редиректит на `/` (query вроде `?ref=` сохраняется).
 * Включить → `true` + redeploy Pages (crawl `/landing/` включается тем же флагом).
 */
export const LANDING_ENABLED = false;
