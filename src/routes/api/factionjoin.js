/*
 * join a faction
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { getFactionInfo, joinFaction } from '../../data/sql/Faction.js';

export default async function factionjoin(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { t }, user, id: { ipString }, body: { fid } } = req;

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

  const ret = await joinFaction(user.id, ipString, factionInfo.sqlFid);
  switch (ret) {
    case 0:
      break;
    case 1:
      throw new Error(t`You are banned from this faction`);
    case 2:
      throw new Error(t`You are already part of this faction`);
    default:
      throw new Error(t`Server Error`);
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
