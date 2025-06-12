/*
 *
 */
import {
  getBanInfo,
  unbanIP,
} from '../../data/sql/Ban';
import {
  getCacheAllowed,
  cleanCacheForIP,
} from '../../data/redis/isAllowedCache';

async function baninfo(req, res, next) {
  try {
    const { t, user, ip: { ipString }} = req.ttag;

    const info = await getBanInfo(ipString, user?.id);

    if (!info) {
      const cache = await getCacheAllowed(ip);
      if (cache && cache.status === 2) {
        cleanCacheForIP(ip);
      }
      throw new Error(t`You are not banned`);
    }
    let sleft = (info.expires)
      ? Math.round((info.expires.getTime() - Date.now()) / 1000)
      : 0;

    if (info.expires && sleft < 3) {
      await unbanIP(ip);
      sleft = -1;
    }

    res.status(200).json({
      reason: info.reason,
      sleft,
      mod: `${info.mod.name} (${info.mod.id})`,
    });
  } catch (err) {
    next(err);
  }
}

export default baninfo;
