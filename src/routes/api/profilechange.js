/*
 *
 * change stuff in a users profile
 * TODO: this should be an universal api, privatize etc. should be merged into
 * it
 *
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import { getMediaType } from '../../data/sql/Media.js';
import { setUserAvatar } from '../../data/sql/Profile.js';

async function profilechange(req, res) {
  const { profile } = req.body;
  const { user } = req;

  if (!profile || typeof profile !== 'object') {
    throw new Error('Invalid request, no profile object included');
  }

  const { avatarId } = profile;
  let changed = false;
  let needsReload = false;
  if (avatarId === null) {
    changed = true;
    needsReload = true;
    const success = await setUserAvatar(user.id, null);
    if (success) {
      logger.info(`User ${user.name} removed his avatar`);
    } else {
      throw new Error('Could not remove your avatar');
    }
  } else if (typeof avatarId === 'string') {
    changed = true;
    needsReload = true;
    const isLegitMedia = await getMediaType(avatarId) === 'image';
    if (!isLegitMedia) {
      throw new Error('Invalid id for avatar image');
    }
    const success = await setUserAvatar(user.id, avatarId);
    if (success) {
      logger.info(`User ${user.name} changed avatar to ${avatarId}`);
    } else {
      throw new Error('Could not set your avtar');
    }
  }

  if (!changed) {
    throw new Error('You did not define anything to change');
  }

  if (needsReload) {
    socketEvents.reloadUser(user.id);
  }

  res.json({
    status: 'ok',
  });
}

export default profilechange;
