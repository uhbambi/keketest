import Sequelize, { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize';
import { HourlyCron } from '../../utils/cron';
import BanHistory from './BanHistory';
import IPBan from './association_models/IPBan';
import UserBan from './association_models/UserBan';
import ThreePID from './ThreePID';
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

  ban: {
    type: DataTypes.VIRTUAL,
    get() {
      return !!(this.flags & 0x01);
    },
    set(num) {
      const val = (num) ? (this.flags | 0x01) : (this.flags & ~0x01);
      this.setDataValue('flags', val);
    },
  },

  mute: {
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
 * Given a list of bans, determine if we are banned or muted or both,
 * and what is the best time to re-check
 * @param bans [ { expires, flags,... },... ]
 * isBanned and isMuted are false or true if perma banned and timestamp
 * otherwise
 * @return [ isBanned, isMuted, banRecheckTs ]
 */
export function parseListOfBans(bans) {
  let isBanned = false;
  let isMuted = false;
  let banRecheckTs = null;

  if (bans.length) {
    let i = bans.length;
    while (i > 0) {
      i -= 1;
      const { expires, flags } = bans[i];
      if (flags & 0x01) {
        if (isBanned !== true) {
          if (expires === null) {
            isBanned = true;
          } else {
            const expiresTs = expires.getTime();
            if (isBanned === false || expiresTs > isBanned) {
              isBanned = expiresTs;
            }
          }
        }
      }
      if (flags & 0x02) {
        if (isMuted !== true) {
          if (expires === null) {
            isMuted = true;
          } else {
            const expiresTs = expires.getTime();
            if (isMuted === false || expiresTs > isMuted) {
              isMuted = expiresTs;
            }
          }
        }
      }
    }

    const isBannedIsInteger = Number.isInteger(isBanned);
    const isMutedIsInteger = Number.isInteger(isMuted);
    if (isBannedIsInteger || isMutedIsInteger) {
      if (isBannedIsInteger && isMutedIsInteger) {
        banRecheckTs = Math.min(isBanned, isMuted);
      } else if (isBannedIsInteger) {
        banRecheckTs = isBanned;
      } else {
        banRecheckTs = isMuted;
      }
    }
  }
  return [isBanned, isMuted, banRecheckTs];
}

/**
 * Lift multiple Bans
 * @param bans Array of Ban model instances
 * @param [modUid] user id of mod that lifted the bans
 */
async function removeBans(bans, modUid) {
  if (!Array.isArray(bans)) bans = [bans];
  const banUuids = bans.map((b) => b.uuid);

  const transaction = await sequelize.transaction();

  try {
    if (modUid) {
      await BanHistory.bulkCreate(bans.map((b) => ({
        uuid: b.uuid,
        reason: b.reason,
        flags: b.flags,
        started: b.createdAt,
        ended: b.expires,
        muid: b.muid,
        liftedAt: null,
      })), {
        transaction,
      });
    } else {
      await BanHistory.bulkCreate(bans.map((b) => ({
        uuid: b.uuid,
        reason: b.reason,
        flags: b.flags,
        started: b.createdAt,
        ended: b.expires,
        muid: b.muid,
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

    if (rows.length) {
      await IPBanHistory.bulkCreate(rows.map((row) => ({
        buuid: row.buuid, ip: row.ip,
      })), { transaction });
    }
    /* users */
    rows = await UserBan.findAll({
      attributes: ['buuid', 'uid'],
      where: { buuid: banUuids },
      raw: true,
      transaction,
    });

    if (rows.length) {
      await UserBanHistory.bulkCreate(rows.map((row) => ({
        buuid: row.buuid, uid: row.uid,
      })), { transaction });
    }
    /* ThreePIDs */
    rows = await ThreePIDBan.findAll({
      attributes: ['buuid', 'tid'],
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
  }
  return null;
}
HourlyCron.hook(cleanBans);

/**
 * unban
 * @param buuid uuid of ban
 * @param [modUid] user id of mod that lifted the bans
 * @return boolean success
 */
export async function unbanByUuid(uuid, modUid) {
  try {
    const banModel = await Ban.findOne({
      attributes: ['uuid', 'reason', 'flags', 'expires', 'createdAt', 'muid'],
      where: {
        uuid: Sequelize.fn('UUID_TO_BIN', uuid),
      },
      raw: true,
    });
    if (!banModel) {
      return false;
    }
    await removeBans(banModel, modUid);
    return true;
  } catch (error) {
    console.error(`SQL Error on unban: ${error.message}`);
  }
  return false;
}

/**
 * get all bans for ips or user ids
 * @param userIds Array of user ids
 * @param ipStrings Array of ipStrings
 * @param mute boolean if muting
 * @param bans boolean if banning
 * @return [{
 *   uuid, reason, flags, expires, createdAt, muid,
 *   mod: {
 *     id, name,
 *   }
 * }, ...],
 */
export async function getBanInfos(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, mute = true, ban = true,
) {
  if (!ban && !mute) {
    return [];
  }

  try {
    const nestedOr = [];
    const where = {
      [Op.and]: [{
        [Op.or]: [
          { expires: { [Op.gt]: Sequelize.fn('NOW') } },
          { expires: null },
        ],
      }, {
        [Op.or]: nestedOr,
      }],
    };
    if (!mute || !ban) {
      where[Op.and].push({ flags: (ban) ? 0x01 : 0x02 });
    }

    const include = [{
      association: 'mod',
      attributes: ['id', 'name'],
    }];

    if (userIds) {
      nestedOr.push({ [Sequelize.col('tpids.uid')]: userIds });
      nestedOr.push({ [Sequelize.col('users.id')]: userIds });
      include.push({
        association: 'tpids',
        attributes: [],
      });
      include.push({
        association: 'users',
        attributes: [],
      });
    }

    if (ipStrings) {
      if (Array.isArray(ipStrings)) {
        ipStrings.map((ip) => Sequelize.fn('IP_TO_BIN', ip));
      } else {
        ipStrings = Sequelize.fn('IP_TO_BIN', ipStrings);
      }
      nestedOr.push({ [Sequelize.col('ips.ip')]: ipStrings });
      include.push({
        association: 'ips',
        attributes: [],
      });
    }

    const bans = await Ban.findAll({
      attributes: [
        'uuid', 'reason', 'flags', 'expires', 'createdAt', 'muid',
        [Sequelize.fn('BIN_TO_UUID', Sequelize.col('uuid')), 'buuid'],
      ],
      where, include,
      raw: true,
      nested: true,
    });

    return bans;
  } catch (error) {
    console.error(`SQL Error on getBanInfos: ${error.message}`);
  }
  return [];
}

/**
 * ban
 * @param userIds Array of user ids
 * @param ipStrings Array of ipStrings
 * @param mute boolean if muting
 * @param ban boolean if banning
 * @param reason reasoning as string
 * @param duration duration in seconds
 * @param muid id of the mod that bans
 * @return boolean success
 */
export async function ban(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, mute, ban, reason, duration, muid = null,
) {
  try {
    const transaction = await sequelize.transaction();

    try {
      const banModel = await Ban.create({
        reason, muid, ban, mute,
        expires: (duration) ? new Date(Date.now() + duration * 1000) : null,
      }, { transaction });
      const buuid = banModel.uuid;

      const promises = [];
      /* userIds is either null or an Array or a sinlge userId */
      if (userIds) {
        const threePIDs = await ThreePID.findAll({
          where: { uid: userIds },
          raw: true,
        });
        if (threePIDs.length) {
          promises.push(ThreePIDBan.bulkCreate(threePIDs.map(
            (tpid) => ({ buuid, tid: tpid.id }),
          ), { returning: false, transaction }));
        }
        if (Array.isArray(userIds)) {
          if (userIds.length) {
            promises.push(UserBan.bulkCreate(userIds.map(
              (uid) => ({ buuid, uid }),
            ), { returning: false, transaction }));
          }
        } else {
          promises.push(UserBan.create({ uid: userIds, buuid },
            { returning: false, transaction }));
        }
      }

      if (ipStrings) {
        if (Array.isArray(ipStrings)) {
          if (ipStrings.length) {
            promises.push(IPBan.bulkCreate(ipStrings.map(
              (ip) => ({ buuid, ip: Sequelize.fn('IP_TO_BIN', ip) }),
            ), { returning: false, transaction }));
          }
        } else {
          promises.push(IPBan.create({
            buuid, ip: Sequelize.fn('IP_TO_BIN', ipStrings),
          }, { returning: false, transaction }));
        }
      }
      await Promise.all(promises);
      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`SQL Error on ban: ${error.message}`);
  }
  return false;
}

/**
 * unban by user and/or ip
 * @param userIds Array of user ids
 * @param ipStrings Array of ipStrings
 * @param mute boolean if unmuting
 * @param ban boolean if unbanning
 * @param muid id of the mod that bans
 * @return boolean success
 */
export async function unban(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, mute, ban, muid = null,
) {
  try {
    const bans = await getBanInfos(userIds, ipStrings, mute, ban);
    if (!bans.length) {
      return 0;
    }
    await removeBans(bans, muid);
    return bans.length;
  } catch (error) {
    console.error(`SQL Error on unban: ${error.message}`);
  }
  return null;
}

export default Ban;
