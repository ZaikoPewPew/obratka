/**
 * Очередь портфолио на ревью (stub).
 *
 * @typedef {{
 *   id: string;
 *   url: string;
 *   name?: string;
 *   status?: 'pending' | 'done' | 'skipped';
 * }} PortfolioQueueItem
 */

/**
 * @returns {Promise<PortfolioQueueItem[]>}
 */
export async function listPortfoliosForReview() {
  return [];
}

/**
 * @param {string} _id
 * @returns {Promise<PortfolioQueueItem | null>}
 */
export async function getPortfolio(_id) {
  return null;
}
