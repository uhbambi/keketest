/*
 *
 * Database layout for Chat Channels
 *
 */

import { DataTypes } from 'sequelize';

import sequelize from './sequelize';
import { UserChannel } from './association_models/UserChannel';

export { CHANNEL_TYPES } from '../../core/constants';

const Channel = sequelize.define('Channel', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
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

export default Channel;
