/*
 *
 * change stuff of a user
 *
 */
import logger from '../../core/logger.js';
import { setFlagOfUser } from '../../data/sql/User.js';
import socketEvents from '../../socket/socketEvents.js';
import { USER_FLAGS } from '../../core/constants.js';

async function userchange(req, res) {
  req.tickRateLimiter(15000);
  const { ttag: { t }, user, body: { user: userData } } = req;

  if (!userData || typeof userData !== 'object') {
    throw new Error('Invalid request, no user object included');
  }

  const { blockDm, priv } = userData;
  let changed = false;
  const userChanges = {};

  if (typeof priv === 'boolean') {
    changed = true;
    userChanges.prv = priv;
    const success = await setFlagOfUser(user.id, USER_FLAGS.PRIV, priv);
    if (success) {
      logger.info(`User ${user.name} changed priv to ${priv}`);
    } else {
      throw new Error(t`Could not change this setting. Maybe try again later.`);
    }
  }

  if (typeof blockDm === 'boolean') {
    changed = true;
    userChanges.blockDm = blockDm;
    const success = await setFlagOfUser(user.id, USER_FLAGS.BLOCK_DM, blockDm);
    if (success) {
      logger.info(`User ${user.name} changed blockDm to ${blockDm}`);
    } else {
      throw new Error(t`Could not change this setting. Maybe try again later.`);
    }
  }

  if (!changed) {
    throw new Error('You did not define anything to change');
  }

  const changedKeys = Object.keys(userChanges);
  for (let i = 0; i < changedKeys.length; i += 1) {
    const key = changedKeys[i];
    const value = userChanges[key];
    socketEvents.patchUserState(user.id, 'user', {
      op: 'set',
      path: key,
      value,
    });
  }

  res.json({
    status: 'ok',
  });
}

export default userchange;
