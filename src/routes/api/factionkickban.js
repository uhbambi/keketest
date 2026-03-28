/*
 * kick / ban user from faction
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import {
  getFactionInfo, leaveFaction, getFactionLvlOfUser,
} from '../../data/sql/Faction.js';
import { getLastIPOfUser } from '../../data/sql/User.js';
import {
  banUserFromFaction,
} from '../../data/sql/FactionBan.js';
import { FACTIONLVL } from '../../core/constants.js';

export default async function factionkickban(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { t }, user, body: { fid, uid, isBan } } = req;

  if (!fid || typeof fid !== 'string') {
    throw new Error('No faction given');
  }
  if (typeof uid !== 'number' || !Number.isInteger(uid)) {
    throw new Error('No user given');
  }

  const [
    { sqlFid, powerlvl: ownPowerlvl },
    { sqlFid: sqlTargetFid, powerlvl: targetPowerlvl },
  ] = await Promise.all([
    getFactionLvlOfUser(user.id, fid),
    getFactionLvlOfUser(uid, fid),
  ]);
  if (!sqlFid) {
    throw new Error('This faction does not exist or you are not a member');
  }
  if (!sqlTargetFid) {
    throw new Error('User is not a member');
  }
  if (!ownPowerlvl || ownPowerlvl < FACTIONLVL.NOBLE) {
    throw new Error('Insufficient permissions on this faction');
  }
  if (targetPowerlvl >= ownPowerlvl) {
    throw new Error(t`Can not modify user equal to you or above you`);
  }

  const lastOnlineIPString = await getLastIPOfUser(uid);

  const [leaveRet, factionInfo] = await Promise.all([
    leaveFaction(uid, fid),
    getFactionInfo(fid),
  ]);
  switch (leaveRet) {
    case 0:
      break;
    case 1:
      throw new Error(t`This faction does not exist`);
    case 2:
      /* t: when leaving a faction and it is the last owner */
      throw new Error(t`Can not orphan a faction`);
    default:
      throw new Error(t`Server Error`);
  }
  if (!factionInfo) {
    throw new Error(t`This faction does not exist`);
  }

  if (isBan) {
    let { reason, durationMs: duration } = req.body;
    if (typeof reason !== 'string') {
      throw new Error('No reason given');
    }
    reason = reason.trim();
    if (reason.length > 200) {
      throw new Error('Reason can only have 200 characters');
    }
    if (typeof duration === 'number') {
      duration = Math.ceil(duration / 1000);
    } else {
      /* default to perma ban */
      duration = null;
    }

    const success = await banUserFromFaction(
      fid, uid, lastOnlineIPString, reason, duration,
    );
    if (!success) {
      throw new Error(t`Server Error`);
    }
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

  logger.info(`User ${user.id} banned ${uid} from faction ${factionInfo.name}`);
  res.json({
    status: 'ok',
    profilePatch,
    chatPatch,
  });
}
