/*
 * change faction role settings
 *
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { validateFactionName } from '../../utils/validation.js';
import { getFactionLvlOfUser } from '../../data/sql/Faction.js';
import {
  getFactionRole, setFactionRoleFlag, setFactionRoleProperty,
} from '../../data/sql/FactionRole.js';
import { getMediaDimensions } from '../../data/sql/Media.js';
import { FACTIONLVL } from '../../core/constants.js';

export default async function factionrolechange(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { t, gettext }, user, body: factionRoleData } = req;
  const { frid, customFlagId, factionlvl } = factionRoleData;

  if (!frid || typeof frid !== 'string') {
    throw new Error('No faction role given');
  }

  const { fid, sqlFrid, factionlvl: cFactionlvl } = await getFactionRole(frid);

  if (!fid || !sqlFrid) {
    throw new Error('This faction or faction role does not exist');
  }

  const { sqlFid, powerlvl } = await getFactionLvlOfUser(user.id, frid);
  if (!sqlFid) {
    throw new Error('This faction does not exist');
  }
  if (!powerlvl || powerlvl < FACTIONLVL.MAGISTRATE) {
    throw new Error('Insufficient permissions on this faction');
  }

  let { name } = factionRoleData;

  let changed = false;
  const factionRoleChanges = {};

  if (typeof factionlvl === 'number') {
    changed = true;
    factionRoleChanges.factionlvl = factionlvl;
    if (cFactionlvl >= FACTIONLVL.SOVEREIGN) {
      throw new Error(t`Can not change the powerlevel of the Sovereign`);
    }
    if (cFactionlvl >= powerlvl) {
      throw new Error(
        t`Can not change the powerlevel of a role equal or above you`,
      );
    }
    if (factionlvl > powerlvl) {
      throw new Error(
        t`Can not elevate the powerlevel of a role beyond yours`,
      );
    }
    if (factionlvl >= FACTIONLVL.SOVEREIGN) {
      throw new Error(
        t`Can not elevate the powerlevel of a role to Sovereign.`,
      );
    }
    if (factionlvl > 127 || factionlvl < -128) {
      throw new Error('Invalid powerlevel');
    }
    const success = await setFactionRoleProperty(
      sqlFrid, 'factionlvl', factionlvl,
    );
    if (!success) {
      throw new Error('Could not set this roles powerlevel');
    }
    logger.info(
      `User ${user.username} changed role ${frid} powerlevel to ${factionlvl}`,
    );
  }

  if (typeof name === 'string') {
    changed = true;

    name = name.toLowerCase();
    const error = validateFactionName(name);
    if (error) {
      throw new Error(gettext(error));
    }
    factionRoleChanges.name = name;
    const success = await setFactionRoleProperty(sqlFrid, 'name', name);
    if (!success) {
      throw new Error('Could not set name');
    }
    logger.info(
      `AUTH: Changed factions name for ${frid} to ${name} by ${user.id}`,
    );
  }

  if (customFlagId === null || typeof customFlagId === 'string') {
    changed = true;
    factionRoleChanges.customFlagId = customFlagId;
    if (customFlagId) {
      const mediaInfo = await getMediaDimensions(customFlagId);
      if (mediaInfo?.type !== 'image') {
        throw new Error(t`Role flag can only be an image`);
      }
      if (mediaInfo.width !== 16 || mediaInfo.height !== 11) {
        throw new Error(t`Role flag needs to be 16x11`);
      }
    }
    const success = await setFactionRoleFlag(sqlFrid, customFlagId);
    if (!success) {
      throw new Error(t`Could not this roles flag`);
    }
    logger.info(`User ${user.id} changed role ${frid} flag to ${customFlagId}`);
  }

  if (!changed) {
    throw new Error('You did not define anything to change');
  }

  const changedKeys = Object.keys(factionRoleChanges);
  for (let i = 0; i < changedKeys.length; i += 1) {
    const key = changedKeys[i];
    const value = factionRoleChanges[key];
    socketEvents.patchUserState(user.id, 'profile', {
      op: 'setex',
      path: `factions[fid:${fid}].roles[frid:${frid}].${key}`,
      value,
    });
  }

  res.json({
    status: 'ok',
  });
}
