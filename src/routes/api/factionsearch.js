/*
 * search for factions
 */
import { searchFaction } from '../../data/sql/Faction.js';

export default async function factionsearch(req, res) {
  req.tickRateLimiter(3000);
  const { term } = req.body;

  if (!term || typeof term !== 'string') {
    throw new Error('No search term given');
  }

  res.json(await searchFaction(term));
}
