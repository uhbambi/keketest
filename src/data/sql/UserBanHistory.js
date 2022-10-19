import { DataTypes } from 'sequelize';
import sequelize from './sequelize';

/*
 * banning a user happens by
 * - user itself
 * - email
 * - all available threepids
 */
const UserBanHistory = sequelize.define('UserBanHistory', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    primaryKey: true,
  },

  name: {
    type: `${DataTypes.CHAR(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },

  email: {
    type: DataTypes.CHAR(40),
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

export default UserBanHistory;
