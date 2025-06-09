/*
 *
 * Last IP and useragent a user connected with
 *
 */

import { DataTypes } from 'sequelize';
import sequelize from './sequelize';

export default sequelize.define('UserIP', {
  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});
