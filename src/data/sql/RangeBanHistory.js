import { DataTypes } from 'sequelize';
import sequelize from './sequelize.js';

const RangeBanHistory = sequelize.define('RangeBanHistory', {
  rid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },

  reason: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  started: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  ended: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  liftedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

export default RangeBanHistory;
