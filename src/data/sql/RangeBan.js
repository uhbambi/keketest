import { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize';
import { HourlyCron } from '../../utils/cron';
export { RANGEBAN_REASONS } from '../../core/constants';
import IPRangeBanHistory from './IPRangeBanHistory';

const RangeBan = sequelize.define('RangeBan', {
  reason: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  expires: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * Lift multiple IP Range Bans
 * @param bans Array of Ban model instances
 * @param [modUid] user id of mod that lifted the bans
 */
async function removeIPRangeBans(bans, modUid) {
  if (!bans.length) {
    return;
  }
  const transaction = await sequelize.transaction();
  try {
    if (modUid) {
      await IPRangeBanHistory.bulkCreate(bans.map((ban) => ({
        reason: ban.reason,
        started: ban.createdAt,
        ended: ban.expires,
        muid: ban.muid,
        liftedAt: null,
      })), {
        transaction,
      });
    } else {
      await IPRangeBanHistory.bulkCreate(bans.map((ban) => ({
        reason: ban.reason,
        started: ban.createdAt,
        ended: ban.expires,
        muid: ban.muid,
        lmuid: modUid,
      })), {
        transaction,
      });
    }

    RangeBan.destroy({
      where: { rid: bans.map((b) => b.rid) },
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
async function cleanIPRangeBans() {
  try {
    const expiredBans = await RangeBan.findAll({
      attributes: ['reason', 'expires', 'createdAt', 'muid', 'rid'],
      where: {
        expires: { [Op.lte]: new Date() },
      },
      raw: true,
    });

    if (!expiredBans.length) {
      return 0;
    }
    await removeIPRangeBans(expiredBans);
    return expiredBans.length;
  } catch (error) {
    console.error(`SQL Error on cleanIPRangeBans: ${error.message}`);
    return null;
  }
}
HourlyCron.hook(cleanIPRangeBans);

export default RangeBan;
