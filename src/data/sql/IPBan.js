import { DataTypes, Op } from 'sequelize';
import sequelize from './sequelize';

import { HourlyCron } from '../../utils/cron';
import { cleanCacheForIP } from '../redis/isAllowedCache';

const IPBan = sequelize.define('IPBan', {
  reason: {
    type: `${DataTypes.CHAR(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    set(value) {
      this.setDataValue('reason', value.slice(0, 200));
    },
  },

  /*
   * NULL if infinite
   */
  expires: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

async function cleanIpBans() {
  const expiredIPs = await IPBan.findAll({
    attributes: [
      'ip',
    ],
    where: {
      expires: {
        [Op.lte]: new Date(),
      },
    },
    raw: true,
  });
  if (!expiredIPs.length) {
    return;
  }
  const ips = [];
  for (let i = 0; i < expiredIPs.length; i += 1) {
    ips.push(expiredIPs[i].ip);
  }
  await IPBan.destroy({
    where: {
      ip: ips,
    },
  });
  for (let i = 0; i < ips.length; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await cleanCacheForIP(ips[i]);
  }
}
HourlyCron.hook(cleanIpBans);

/*
 * check if ip is banned
 * @param ip
 * @return boolean
 */
export async function isIPBanned(ip) {
  const count = await IPBan
    .count({
      where: { ip },
    });
  return count !== 0;
}

/*
 * get information of ban
 * @param ip
 * @return
 */
export function getBanInfo(ip) {
  return IPBan.findByPk(ip, {
    attributes: ['reason', 'expires'],
    include: {
      association: 'mod',
      attributes: [
        'id',
        'name',
      ],
    },
    raw: true,
    nest: true,
  });
}

/*
 * ban ip
 * @param ip
 * @return true if banned
 *         false if already banned
 */
export async function banIP(
  ip,
  reason,
  expiresTs,
  muid,
) {
  const expires = (expiresTs) ? new Date(expiresTs) : null;
  const [, created] = await IPBan.upsert({
    ip,
    reason,
    expires,
    muid,
  });
  await cleanCacheForIP(ip);
  return created;
}

/*
 * unban ip
 * @param ip
 * @return true if unbanned,
 *         false if ip wasn't banned anyway
 */
export async function unbanIP(ip) {
  const count = await IPBan.destroy({
    where: { ip },
  });
  await cleanCacheForIP(ip);
  return !!count;
}

export default IPBan;
