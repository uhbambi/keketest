/*
 * send global ranking
 */

import rankings from '../core/Ranks.js';

export default (req, res) => {
  res.set({
    'Cache-Control': 'public, s-maxage=180, max-age=280',
  });
  res.json(rankings.ranks);
};
