import { DataTypes, Op } from 'sequelize';
import sequelize from './sequelize';

import { HourlyCron } from '../../utils/cron';
import { cleanCacheForIP } from '../redis/isAllowedCache';

const Ban = sequelize.define('Ban', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  reason: {
    type: `${DataTypes.CHAR(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    set(value) {
      this.setDataValue('reason', value.slice(0, 200));
    },
  },

  /*
   * from lowest to highest bit:
   * 0: banned from placing in game
   * 1: banned from chat
   */
  flags: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
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

  /*
   * virtual
   */

  gameban: {
    type: DataTypes.VIRTUAL,
    get() {
      return !!(this.flags & 0x01);
    },
    set(num) {
      const val = (num) ? (this.flags | 0x01) : (this.flags & ~0x01);
      this.setDataValue('flags', val);
    },
  },

  chatban: {
    type: DataTypes.VIRTUAL,
    get() {
      return !!(this.flags & 0x02);
    },
    set(num) {
      const val = (num) ? (this.flags | 0x02) : (this.flags & ~0x02);
      this.setDataValue('flags', val);
    },
  },
});

async function cleanIpBans() {
  const expiredIPs = await Ban.findAll({
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
  await Ban.destroy({
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
export async function isBanned(ip) {
  const count = await Ban
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
  return Ban.findByPk(ip, {
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
  const [, created] = await Ban.upsert({
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
  const count = await Ban.destroy({
    where: { ip },
  });
  await cleanCacheForIP(ip);
  return !!count;
}

/*
 * check if ThreePID is banned
 * @param provider, tpid What tpid to look for
 * @return boolean
 */
export async function isThreePidBanned(provider, tpid) {
  const count = await Ban
    .count({
      include: {
        association: 'tpids',
        where: {
          provider,
          tpid,
        },
      },
    });
  return count !== 0;
}

export default Ban;
