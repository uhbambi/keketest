/*
 * delete a faction role
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import {
  getFactionLvlOfUser, getAllMembersOfFaction,
} from '../../data/sql/Faction.js';
import {
  getFactionRole, deleteFactionRole,
} from '../../data/sql/FactionRole.js';
import { FACTIONLVL } from '../../core/constants.js';

export default async function factionroledelete(req, res) {
  req.tickRateLimiter(10000);
  const { ttag: { t }, user, body: { frid } } = req;

  if (!frid || typeof frid !== 'string') {
    throw new Error('No faction given');
  }

  const {
    fid, sqlFrid, factionlvl: cFactionlvl, isProtected,
  } = await getFactionRole(frid);

  if (!fid || !sqlFrid) {
    throw new Error('This faction or faction role does not exist');
  }
  if (isProtected) {
    throw new Error(t`Can not delete this role`);
  }

  const { sqlFid, powerlvl } = await getFactionLvlOfUser(user.id, fid);
  if (!sqlFid) {
    throw new Error('This faction does not exist or you are not a member');
  }
  if (!powerlvl || powerlvl < FACTIONLVL.MAGISTRATE) {
    throw new Error('Insufficient permissions on this faction');
  }
  if (cFactionlvl >= powerlvl) {
    throw new Error(t`Can not change a role above your own`);
  }
  if (cFactionlvl >= FACTIONLVL.SOVEREIGN) {
    throw new Error('Can not delete the Sovereign');
  }

  const success = await deleteFactionRole(sqlFid);
  if (!success) {
    throw new Error('Could not delete faction');
  }

  const profilePatch = {
    op: 'del',
    path: `factions[fid:${fid}].roles[frid:${frid}]`,
  };

  const affectedUserIds = await getAllMembersOfFaction(sqlFid);
  if (affectedUserIds.length) {
    socketEvents.patchUserState(user.id, 'profile', profilePatch);
  }

  logger.info(`User ${user.id} deleted faction role ${frid}`);
  res.json({
    status: 'ok',
    profilePatch,
  });
}
