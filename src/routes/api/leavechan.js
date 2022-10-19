/*
 *
 * starts a DM session
 *
 */

import logger from '../../core/logger';
import socketEvents from '../../socket/socketEvents';

async function leaveChan(req, res) {
  const channelId = parseInt(req.body.channelId, 10);
  const { user } = req;

  if (channelId && Number.isNaN(channelId)) {
    res.status(400).json({
      errors: ['Invalid channelId'],
    });
    return;
  }

  const userChannels = user.regUser.channel;
  let channel = null;
  for (let i = 0; i < userChannels.length; i += 1) {
    if (userChannels[i].id === channelId) {
      channel = userChannels[i];
      break;
    }
  }
  if (!channel) {
    res.status(401).json({
      errors: ['You are not in this channel'],
    });
    return;
  }

  /*
   * Just supporting DMs by now, because
   * Channels do not get deleted when all Users left.
   * Group Channels need this.
   * Faction and Default channels should be impossible to leave
   */
  if (channel.type !== 1) {
    res.status(401).json({
      errors: ['Can not leave this channel'],
    });
    return;
  }

  logger.info(
    `Removing user ${user.name} from channel ${channel.name || channelId}`,
  );

  user.regUser.removeChannel(channel);

  socketEvents.broadcastRemoveChatChannel(user.id, channelId);

  res.json({
    status: 'ok',
  });
}

export default leaveChan;
