import { DataTypes } from 'sequelize';
import sequelize from './sequelize';

const IPRangeBanHistory = sequelize.define('IPRangeBanHistory', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
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
});

export default IPRangeBanHistory;
