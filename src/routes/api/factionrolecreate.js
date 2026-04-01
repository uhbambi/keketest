/*
 * create a faction
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { validateFactionName } from '../../utils/validation.js';
import {
  getFactionLvlOfUser, getAllMembersOfFaction,
} from '../../data/sql/Faction.js';
import { createFactionRole } from '../../data/sql/FactionRole.js';
import { FACTIONLVL } from '../../core/constants.js';

export default async function factionrolecreate(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { gettext, t }, user, body: factionRoleData } = req;
  const { customFlagId, fid, factionlvl } = factionRoleData;

  if (!fid || typeof fid !== 'string') {
    throw new Error('No faction given');
  }

  let { name, isDefault } = factionRoleData;
  name = name?.toLowerCase();
  isDefault = !!isDefault;

  const { sqlFid, powerlvl } = await getFactionLvlOfUser(user.id, fid);
  if (!sqlFid) {
    throw new Error('This faction does not exist or you are not a member');
  }
  if (!powerlvl || powerlvl < FACTIONLVL.MAGISTRATE) {
    throw new Error('Insufficient permissions on this faction');
  }

  const errors = [];
  const error = gettext(validateFactionName(name));
  if (error) errors.push(error);
  if (typeof factionlvl !== 'number') {
    errors.push('Must define a factionlvl');
  }
  if (typeof customFlagId !== 'string' && customFlagId !== null) {
    errors.push('Must define a customFlagId');
  }
  if (factionlvl > 127 || factionlvl < -128) {
    errors.push('Invalid factionlvl');
  }
  if (factionlvl >= powerlvl) {
    errors.push(t`Can not create a role with a powerlevel of yours or beyond`);
  }

  if (errors.length) {
    res.status(400).json({ errors });
  }

  const [createRet, frid] = await createFactionRole(
    fid, name, factionlvl, customFlagId, isDefault,
  );
  switch (createRet) {
    case 0:
      break;
    case 1:
      throw new Error(t`This faction does not exist`);
    case 2:
      throw new Error('Invalid customFlagId');
    case 3:
      throw new Error(t`Can not have more than 20 faction roles`);
    default:
      throw new Error(t`Server Error`);
  }

  const profilePatch = {
    op: 'add',
    path: `factions[fid:${fid}].roles`,
    value: { frid, name, customFlagId, factionlvl, isMember: false },
  };

  const affectedUserIds = await getAllMembersOfFaction(sqlFid);
  if (affectedUserIds.length) {
    socketEvents.patchUserState(user.id, 'profile', profilePatch);
  }

  logger.info(`User ${user.id} created new faction ${name}`);
  res.json({
    status: 'ok',
    profilePatch,
  });
}
