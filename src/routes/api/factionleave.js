/*
 * join a faction
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { getFactionInfo, leaveFaction } from '../../data/sql/Faction.js';

export default async function factionleave(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { t }, user, id: { ipString }, body: { fid } } = req;

  if (!fid || typeof fid !== 'string') {
    throw new Error('No faction given');
  }

  const [joinRet, factionInfo] = await Promise.all([
    leaveFaction(user.id, ipString, fid),
    getFactionInfo(fid),
  ]);
  switch (joinRet) {
    case 0:
      break;
    case 1:
      throw new Error(t`This faction does not exist`);
    case 2:
      /* t: when leaving a faction and you are the last owner */
      throw new Error(t`Can not orphan a faction`);
    default:
      throw new Error(t`Server Error`);
  }
  if (!factionInfo) {
    throw new Error(t`This faction does not exist`);
  }

  let chatPatch;
  if (factionInfo.channelId) {
    chatPatch = {
      op: 'del',
      path: `channels[0:${factionInfo.channelId}]`,
    };
    socketEvents.patchUserState(user.id, 'chat', chatPatch);
  }

  const profilePatch = {
    op: 'del',
    path: `factions[fid:${fid}]`,
    value: factionInfo,
  };
  socketEvents.patchUserState(user.id, 'profile', profilePatch);

  logger.info(`User ${user.id} left faction ${factionInfo.name}`);
  res.json({
    status: 'ok',
    profilePatch,
    chatPatch,
  });
}
