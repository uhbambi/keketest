/*
 * get profile information of user
 */
import { getFishesOfUser } from '../../data/sql/Fish.js';
import { getBadgesOfUser } from '../../data/sql/Badge.js';
import { getFactionsOfUser } from '../../data/sql/Faction.js';

export default async (req, res) => {
  const { user: { id: uid, data: { customFlag, avatarId } } } = req;
  const [
    fishes,
    badges,
    factionObject,
  ] = await Promise.all([
    getFishesOfUser(uid),
    getBadgesOfUser(uid),
    getFactionsOfUser(uid),
  ]);
  res.status(200).json({
    fishes,
    badges,
    ...factionObject,
    customFlag,
    avatarId,
  });
};
