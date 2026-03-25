/*
 * change user specific faction settings
 *
 * this is currently only used for setting a faction hidden from ausers profile
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';

import { setFlagOfUserFaction } from '../../data/sql/Faction.js';
import { USER_FACTION_FLAGS } from '../../core/constants.js';

export default async function userfactionchange(req, res) {
  req.tickRateLimiter(7000);
  const { user, body: { fid, isHidden } } = req;

  if (!fid || typeof fid !== 'string') {
    throw new Error('No faction given');
  }

  let changed = false;
  const userFactionChanges = {};

  if (typeof isHidden === 'boolean') {
    changed = true;
    userFactionChanges.isHidden = isHidden;
    const success = await setFlagOfUserFaction(
      user.id, fid, USER_FACTION_FLAGS.HIDDEN, isHidden,
    );
    if (!success) {
      throw new Error('Could not set this users faction hidden property');
    }
    logger.info(
      `User ${user.username} changed faction ${fid} hidden to ${isHidden}`,
    );
  }

  if (!changed) {
    throw new Error('You did not define anything to change');
  }

  const changedKeys = Object.keys(userFactionChanges);
  for (let i = 0; i < changedKeys.length; i += 1) {
    const key = changedKeys[i];
    const value = userFactionChanges[key];
    socketEvents.patchUserState(user.id, 'profile', {
      op: 'setex',
      path: `factions[fid:${fid}].${key}`,
      value,
    });
  }

  res.json({
    status: 'ok',
  });
}
