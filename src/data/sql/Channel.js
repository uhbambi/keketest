/*
 *
 * Database layout for Chat Channels
 *
 */

import { DataTypes } from 'sequelize';

import sequelize from './sequelize';

export { CHANNEL_TYPES } from '../../core/constants';

const Channel = sequelize.define('Channel', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: `${DataTypes.CHAR(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: true,
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

  lastTs: {
    type: DataTypes.VIRTUAL,
    get() {
      return new Date(this.lastMessage).valueOf();
    },
    set(value) {
      this.setDataValue('lastMessage', new Date(value));
    },
  },
});

export default Channel;
