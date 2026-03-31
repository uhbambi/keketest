/*
 * print all informations about faction members
 *
 */
import {
  getFactionLvlOfUser, getFactionInfo, getFactionMemberInfo,
} from '../../data/sql/Faction.js';
import { FACTIONLVL } from '../../core/constants.js';

export default async function factionrolechange(req, res) {
  req.tickRateLimiter(1000);
  /* user can be undefined when not logged in */
  const { ttag: { t }, user, body: { fidOrName } } = req;

  if (!fidOrName || typeof fidOrName !== 'string') {
    throw new Error('No faction given');
  }

  const [{ powerlvl }, faction] = await Promise.all([
    (user) ? getFactionLvlOfUser(user.id, fidOrName) : { powerlvl: -1 },
    getFactionInfo(fidOrName),
  ]);

  if (!faction) {
    throw new Error(t`This faction does not exist`);
  }
  if (faction.isHidden && powerlvl < 0) {
    throw new Error(t`This faction is hidden`);
  }

  const showHiddenUsers = powerlvl >= FACTIONLVL.NOBLE;
  const members = await getFactionMemberInfo(faction.sqlFid, showHiddenUsers);
  if (!members) {
    throw new Error(t`Server Error`);
  }

  res.json({
    /*
     * [{
     *   uid,
     *   name,
     *   username,
     *   avatarId,
     *   roles: [frid1, frid2, ...],
     * }, ...]
     */
    members,
  });
}
