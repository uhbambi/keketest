/*
 * print information for shards
 */
import socketEvents from '../../socket/socketEvents';

async function shards(req, res, next) {
  try {
    if (!socketEvents.isCluster) {
      res.status(400).json({
        errors: ['Not running as cluster'],
      });
      return;
    }
    const { shardsData } = socketEvents;
    if (!shardsData) {
      res.status(404).json({ errors: ['Shards are not configured.'] });
      return;
    }
    const sanitizedShardsData = {};
    socketEvents.shardsData.forEach(([shard, amountOnlineIps]) => {
      sanitizedShardsData[shard] = {
        online: amountOnlineIps,
      };
    });
    res.status(200).json(sanitizedShardsData);
  } catch (err) {
    next(err);
  }
}

export default shards;
