/*
 * print all informations about faction, except users
 *
 */
import {
  getFactionLvlOfUser, getFactionInfo,
} from '../../data/sql/Faction.js';

export default async function factionrolechange(req, res) {
  req.tickRateLimiter(7000);
  /* user can be undefined when not logged in */
  const { ttag: { t }, user, body: { fid } } = req;

  if (!fid || typeof fid !== 'string') {
    throw new Error('No faction role given');
  }

  const [{ powerlvl }, faction] = await Promise.all([
    (user) ? getFactionLvlOfUser(user.id, fid) : { powerlvl: -1 },
    getFactionInfo(fid),
  ]);

  if (faction.isHidden && powerlvl < 0) {
    throw new Error(t`This faction is hidden`);
  }

  delete faction.sqlFid;
  delete faction.channelId;

  res.json({
    powerlvl,
    faction,
  });
}
