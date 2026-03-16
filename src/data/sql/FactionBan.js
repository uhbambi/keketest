/*
 * bans for factions
 */
import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';

const FactionBan = sequelize.define('FactionBan', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  fid: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  reason: {
    type: `${DataTypes.STRING(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
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
}, {
  indexes: [{
    name: 'ban_fid',
    fields: ['fid'],
  }],
});

export default FactionBan;
