/*
 *
 * starts a DM session
 *
 */

import logger from '../../core/logger';
import socketEvents from '../../socket/socketEvents';
import { CHANNEL_TYPES } from '../../core/constants';
import {
  deleteChannel, amountOfUsersInChannel, removeUserFromChannel
} from '../../data/sql/Channel';

async function leaveChan(req, res) {
  const channelId = parseInt(req.body.channelId, 10);
  const { user } = req;

  if (Number.isNaN(channelId)) {
    res.status(400).json({
      errors: ['Invalid channelId'],
    });
    return;
  }

  const channel = user.getChannel(channelId);
  if (!channel) {
    res.status(401).json({
      errors: ['You are not in this channel'],
    });
    return;
  }
  const type = channel[1];

  if (channel.type === CHANNEL_TYPES.DM) {
    /* if one user leaves a DM, delete the channel */
    const uidB = channel[3];
    if (uidB) {
      const deleted = await deleteChannel(channelId);
      if (deleted) {
        socketEvents.broadcastRemoveChatChannel(uidB, channelId);
      }
    }
  } else if (channel.type === CHANNEL_TYPES.GROUP) {
    await removeUserFromChannel(user.id, channelId);
    const userAmount = await amountOfUsersInChannel(channelId);
    /* delete the group channel if it is empty */
    if (userAmount === 0) {
      await deleteChannel(channelId);
    }
  } else {
    /* presumable PUBLIC channel */
    res.status(401).json({
      errors: ['Can not leave this channel'],
    });
    return;
  }

  logger.info(
    `Removing user ${user.name} from channel ${channel[0] || channelId}`,
  );

  socketEvents.broadcastRemoveChatChannel(user.id, channelId);

  res.json({
    status: 'ok',
  });
}

export default leaveChan;
