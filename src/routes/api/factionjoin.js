/*
 * join a faction
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { getFactionInfo, joinFaction } from '../../data/sql/Faction.js';

export default async function factionjoin(req, res) {
  req.tickRateLimiter(7000);
  const { user, body: { fid } } = req;

  if (!fid || typeof fid !== 'string') {
    throw new Error('No faction given');
  }

  const factionInfo = await getFactionInfo(fid);
  if (!factionInfo) {
    throw new Error('Could not find faction');
  }
  if (!factionInfo.isPublic) {
    throw new Error('You need an invite to join this faction');
  }

  const success = await joinFaction(user.id, factionInfo.sqlFid);
  if (!success) {
    throw new Error('Could not join faction');
  }

  /*
   * turn info object into faction object for user profile
   */
  factionInfo.isHidden = false;
  for (let i = 0; i < factionInfo.roles.length; i += 1) {
    const role = factionInfo.roles[i];
    role.isMember = role.frid === factionInfo.defaultFrid;
  }
  delete factionInfo.sqlFid;
  delete factionInfo.defaultFrid;

  const profilePatch = {
    op: 'push',
    path: 'factions',
    value: factionInfo,
  };
  socketEvents.patchUserState(user.id, 'profile', profilePatch);

  logger.info(`User ${user.id} joined faction ${fid}`);
  res.json({
    status: 'ok',
    profilePatch,
  });
}
