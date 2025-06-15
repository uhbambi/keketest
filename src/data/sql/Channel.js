/*
 *
 * Database layout for Chat Channels
 *
 */

import Sequelize, { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize';
import { UserChannel } from './association_models/UserChannel';

import { CHANNEL_TYPES } from '../../core/constants';

export { CHANNEL_TYPES };

const Channel = sequelize.define('Channel', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: DataTypes.STRING(32),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    allowNull: true,
    set(value) {
      this.setDataValue('name', value.slice(0, 32));
    },
  },

  type: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  lastMessage: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * add a user to a channel
 * @param uid user id
 * @param cid channel id
 * @return boolean success
 */
export async function addUserToChannel(uid, cid) {
  try {
    const [, created] = await UserChannel.findOrCreate({
      where: { uid, cid },
      raw: true,
    });
    return created;
  } catch (error) {
    console.error(`SQL Error on addUserToChannel: ${error.message}`);
  }
  return false;
}

/**
 * find DM channel between users
 * @param uidA user id of user A
 * @param uidB user id of user B
 * @return channel id of DM channel or null if none exists
 */
export async function findDMChannel(uidA, uidB) {
  if (!uidA || !uidB) {
    return null;
  }
  try {
    const channel = await Channel.findOne({
      attributes: ['id'],
      where: { type: CHANNEL_TYPES.DM },
      include: {
        association: 'users',
        where: {
          id: [uidA, uidB],
          required: true,
        },
        group: ['Channel.id'],
        having: Sequelize.where(
          Sequelize.fn('COUNT', Sequelize.col('users.id')),
          { [Op.eq]: 2 },
        ),
      },
    });
    if (channel) {
      return channel.id;
    }
  } catch (error) {
    console.error(`SQL Error on findDMChannel: ${error.message}`);
  }
  return null;
}

/**
 * create DM between two users
 * @param uidA user id of user A
 * @param uidB user id of user B
 */
export async function createDMChannel(uidA, uidB) {
  let cid = await findDMChannel(uidA, uidB);
  if (cid) {
    return null;
  }
  const transaction = await sequelize.transaction();

  try {
    const channel = Channel.create({
      where: { type: CHANNEL_TYPES.DM },
      raw: true,
    }, { transaction });
    cid = channel.id;
    await UserChannel.bulkCreate([
      { uid: uidA, cid }, { uid: uidB, cid },
    ], { transaction });

    return cid;
    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * delete dem channel between users if one exists
 * @param uidA user id of user A
 * @param uidB user id of user B
 * @return channelId if success, null if not
 */
export async function deleteDMChannel(uidA, uidB) {
  try {
    const channelId = await findDMChannel(uidA, uidB);
    const rows = await Channel.destroy({ where: { id: channelId } });
    return channelId;
  } catch (error) {
    console.error(`SQL Error on deleteDMChannel: ${error.message}`);
  }
  return null;
}

/**
 * delete channel
 * @param id channel id
 * @return boolean if successful
 */
export async function deleteChannel(id) {
  try {
    const rows = await Channel.destroy({ where: { id } });
    return rows > 0;
  } catch (error) {
    console.error(`SQL Error on deleteChannel: ${error.message}`);
  }
  return false;
}

/**
 * get amount of users in a channel
 * @param cid channel id
 * @return number | null
 */
export async function amountOfUsersInChannel(cid) {
  try {
    const rows = await UserChannel.count({ where: { cid } });
    return rows;
  } catch (error) {
    console.error(`SQL Error on amountOfUsersInChannel: ${error.message}`);
  }
  return null;
}

/**
 * remove a user from a channel
 * @param uid user id
 * @param cuid channel id
 * @return boolean success
 */
export async function removeUserFromChannel(uid, cid) {
  try {
    const rows = await UserChannel.destroy({ where: { uid, cid } });
    return rows > 0;
  } catch (error) {
    console.error(`SQL Error on removeUserFromChannel: ${error.message}`);
  }
  return false;
}


/**
 * delete all DM channels belonging to a user
 * @param uid user id
 * @return [{ cid, uidA, uidB }, ...] destroyed channels
 */
export async function deleteAllDMChannelsOfUser(uid) {
  try {
    const rows = await Channel.findAll({
      attributes: ['id'],
      where: {
        type: CHANNEL_TYPES.DM,
        [Sequelize.col('User.id')]: uid,
      },
      include: {
        association: 'users',
        attributes: ['id'],
      },
      raw: true,
      nested: true,
    });
    if (!rows.length) {
      return rows;
    }
    const cids = [];
    const dmChannels = rows.map((r) => {
      cids.push(r.id);
      return {
        cid: r.id,
        uidA: uid,
        uidB: r.users.filter((u) => u.id !== uid)[0].id,
      };
    });
    await Channel.destroy({ where: { id: cids } });
    return dmChannels;
  } catch (error) {
    console.error(`SQL Error on deleteAllDMChannelsOfUser: ${error.message}`);
    return null;
  }
  return [];
}

/**
 * find or create a default channel
 * @param name name of channel
 */
export function getDefaultChannel(name) {
  return Channel.findOrCreate({
    where: { name, type: CHANNEL_TYPES.PUBLIC },
    raw: true,
  });
}

export default Channel;
