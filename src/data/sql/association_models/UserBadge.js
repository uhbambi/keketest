/*
 * Badges owned by User
 */

import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

export default sequelize.define('UserBadge', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});
