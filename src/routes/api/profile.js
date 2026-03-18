/*
 * get profile information of user
 */
import { getFishesOfUser } from '../../data/sql/Fish.js';
import { getBadgesOfUser } from '../../data/sql/Badge.js';
import { getFactionsOfUser } from '../../data/sql/Faction.js';

export default async (req, res) => {
  const { user: { id: uid } } = req;
  const [
    fishes,
    badges,
    factions,
  ] = await Promise.all([
    getFishesOfUser(uid),
    getBadgesOfUser(uid),
    getFactionsOfUser(uid),
  ]);
  res.status(200).json({ fishes, badges, factions });
};
