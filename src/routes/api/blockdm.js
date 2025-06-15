/*
 *
 * block all private messages
 *
 */
import logger from '../../core/logger';
import socketEvents from '../../socket/socketEvents';
import { setFlagOfUser } from '../../data/sql/User';
import { deleteAllDMChannelsOfUser } from '../../data/sql/Channel';
import { USER_FLAGS } from '../../core/constants';

async function blockdm(req, res) {
  const { block } = req.body;
  const { user } = req;

  if (typeof block !== 'boolean') {
    res.status(400).json({
      errors: ['Not defined if blocking or unblocking'],
    });
    return;
  }

  logger.info(`User ${user.name} (un)blocked all dms`);

  await setFlagOfUser(user.id, USER_FLAGS.BLOCK_DM, block);

  if (block) {
    const dmChannels = await deleteAllDMChannelsOfUser(user.id);
    if (dmChannels?.length > 0) {
      dmChannels.forEach(({ cid, uidA, uidB }) => {
        socketEvents.broadcastRemoveChatChannel(uidA, cid);
        socketEvents.broadcastRemoveChatChannel(uidB, cid);
      });
    }
  }

  res.json({
    status: 'ok',
  });
}

export default blockdm;
