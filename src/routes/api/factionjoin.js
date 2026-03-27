/*
 * join a faction
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { getFactionInfo, joinFactionPublic } from '../../data/sql/Faction.js';
import { MAX_FACTIONS_PER_USER } from '../../core/constants.js';

export default async function factionjoin(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { t }, user, id: { ipString }, body: { fid } } = req;

  if (!fid || typeof fid !== 'string') {
    throw new Error('No faction given');
  }

  const [joinRet, factionInfo] = await Promise.all([
    joinFactionPublic(user.id, ipString, fid),
    getFactionInfo(fid),
  ]);
  switch (joinRet) {
    case 0:
      break;
    case 1:
      throw new Error(t`This faction does not exist`);
    case 2:
      throw new Error(
        t`You can only have ${MAX_FACTIONS_PER_USER} factions in total`,
      );
    case 3:
      throw new Error(t`You are banned from this faction`);
    case 4:
      throw new Error(t`You are already part of this faction`);
    case 5:
      throw new Error(t`This faction is full`);
    case 6:
      throw new Error(t`You need an invite to join this faction`);
    default:
      throw new Error(t`Server Error`);
  }
  if (!factionInfo) {
    throw new Error(t`This faction does not exist`);
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

  let chatPatch;
  if (factionInfo.channelId) {
    chatPatch = {
      op: 'push',
      path: 'channels',
      value: [
        getFactionInfo.channelId, factionInfo.name, Date.now(), Date.now(),
        false, factionInfo.avatarId,
      ],
    };
    socketEvents.patchUserState(user.id, 'chat', chatPatch);
    delete factionInfo.channelId;
  }

  const profilePatch = {
    op: 'push',
    path: 'factions',
    value: factionInfo,
  };
  socketEvents.patchUserState(user.id, 'profile', profilePatch);

  logger.info(`User ${user.id} joined faction ${factionInfo.name}`);
  res.json({
    status: 'ok',
    profilePatch,
    chatPatch,
  });
}
