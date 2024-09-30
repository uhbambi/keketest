import { DataTypes } from 'sequelize';
import sequelize from './sequelize';

const IPBanHistory = sequelize.define('IPBanHistory', {
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

  started: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  ended: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default IPBanHistory;
