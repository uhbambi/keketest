import Sequelize, { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize';
import { HourlyCron } from '../../utils/cron';
import { cleanCacheForIP } from '../redis/isAllowedCache';
import BanHistory from './BanHistory';
import IPBan from './association_models/IPBan';
import UserBan from './association_models/UserBan';
import ThreePIDBan from './association_models/ThreePIDBan';
import IPBanHistory from './association_models/IPBanHistory';
import UserBanHistory from './association_models/UserBanHistory';
import ThreePIDBanHistory from './association_models/ThreePIDBanHistory';

const Ban = sequelize.define('Ban', {
  uuid: {
    type: 'BINARY(16)',
    defaultValue: Sequelize.literal('UUID_TO_BIN(UUID())'),
    allowNull: false,
    primaryKey: true,
  },

  reason: {
    type: DataTypes.STRING(200),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
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
    type: DataTypes.TINYINT.UNSIGNED,
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

/**
 * Lift multiple Bans
 * @param bans Array of Ban model instances
 * @param [modUid] user id of mod that lifted the bans
 */
async function removeBans(bans, modUid) {
  if (!bans.length) {
    return;
  }
  const banUuids = bans.map((b) => b.uuid);

  const transaction = await sequelize.transaction();

  try {
    if (modUid) {
      await BanHistory.bulkCreate(bans.map((ban) => ({
        uuid: ban.uuid,
        reason: ban.reason,
        flags: ban.flags,
        started: ban.createdAt,
        ended: ban.expires,
        muid: ban.muid,
        liftedAt: null,
      })), {
        transaction,
      });
    } else {
      await BanHistory.bulkCreate(bans.map((ban) => ({
        uuid: ban.uuid,
        reason: ban.reason,
        flags: ban.flags,
        started: ban.createdAt,
        ended: ban.expires,
        muid: ban.muid,
        lmuid: modUid,
      })), {
        transaction,
      });
    }

    /* ips */
    let rows = await IPBan.findAll({
      attributes: [
        'buuid', 'ip',
        [Sequelize.fn('BIN_TO_IP', Sequelize.col('ip')), 'ipString'],
      ],
      where: { buuid: banUuids },
      raw: true,
      transaction,
    });
    const clearedIPs = rows.map((r) => r.ipString);

    if (rows.length) {
      await IPBanHistory.bulkCreate(rows.map((row) => ({
        buuid: row.buuid, ip: row.ip,
      })), { transaction });
    }
    /* users */
    rows = await UserBan.findAll({
      attributes: [ 'buuid', 'uid' ],
      where: { buuid: banUuids },
      raw: true,
      transaction,
    });
    const clearedUserIds = rows.map((r) => r.uid);

    if (rows.length) {
      await UserBanHistory.bulkCreate(rows.map((row) => ({
        buuid: row.buuid, uid: row.uid,
      })), { transaction });
    }
    /* ThreePIDs */
    rows = await ThreePIDBan.findAll({
      attributes: [ 'buuid', 'tid' ],
      where: { buuid: banUuids },
      raw: true,
      transaction,
    });

    if (rows.length) {
      await ThreePIDBanHistory.bulkCreate(rows.map((row) => ({
        buuid: row.buuid, uid: row.tid,
      })), { transaction });
    }

    /* ban destruction will cascade to junction tables */
    await Ban.destroy({
      where: { buuid: banUuids },
      transaction,
    });

    for (let i = 0; i < clearedIPs.length; i += 1) {
      // eslint-disable-next-line no-await-in-loop
      await cleanCacheForIP(clearedIPs[i]);
    }

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/*
 * periodically check for expired bans and remove them if expired
 */
async function cleanBans() {
  try {
    const expiredBans = await Ban.findAll({
      attributes: ['uuid', 'reason', 'flags', 'expires', 'createdAt', 'muid'],
      where: {
        expires: { [Op.lte]: new Date() },
      },
      raw: true,
    });

    if (!expiredBans.length) {
      return 0;
    }
    await removeBans(expiredBans);
    return expiredBans.length;
  } catch (error) {
    console.error(`SQL Error on cleanBans: ${error.message}`);
    return null;
  }
}
HourlyCron.hook(cleanBans);

/**
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

/**
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

/**
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

/**
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

/**
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
