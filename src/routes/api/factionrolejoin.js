/*
 * join user to  afaction role,
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { getFactionLvlOfUser } from '../../data/sql/Faction.js';
import {
  getFactionRole, joinFactionRole,
} from '../../data/sql/FactionRole.js';
import { FACTIONLVL } from '../../core/constants.js';

export default async function factionjoin(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { t }, user, body: { frid, uid } } = req;

  if (!frid || typeof frid !== 'string') {
    throw new Error('No faction role given');
  }
  if (typeof uid !== 'number' || !Number.isInteger(uid)) {
    throw new Error('No user given');
  }

  const {
    fid, sqlFrid, factionlvl: cFactionlvl,
  } = await getFactionRole(frid);

  if (!fid || !sqlFrid) {
    throw new Error('This faction or faction role does not exist');
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
  if (targetPowerlvl >= ownPowerlvl
    && uid !== user.id
  ) {
    throw new Error('Can not modify user equal to you or above you');
  }
  if (cFactionlvl > ownPowerlvl) {
    throw new Error(t`Can not change a role above your own`);
  }
  if (ownPowerlvl < FACTIONLVL.SOVEREIGN
    /* cant join others to your own role, unless your are Sovereign */
    && cFactionlvl === ownPowerlvl
    /* may join yourself to roles equal to yours */
    && uid !== user.id
  ) {
    throw new Error(t`Can not change a role that is equal to your own`);
  }

  const success = await joinFactionRole(sqlFrid, uid);
  if (!success) {
    throw new Error(t`Server Error`);
  }

  const profilePatch = {
    op: 'set',
    path: `factions[fid:${fid}].roles[frid:${frid}].isMember`,
    value: true,
  };
  socketEvents.patchUserState(uid, 'profile', profilePatch);

  logger.info(`User ${user.id} joined ${uid} to role ${frid}`);
  res.json({
    status: 'ok',
  });
}
