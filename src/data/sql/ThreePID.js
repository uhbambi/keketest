/**
 *
 * Storing third party IDs for oauth login
 */

import { DataTypes } from 'sequelize';

import sequelize from './sequelize';

export { THREEPID_PROVIDERS } from '../../core/constants';

const ThreePID = sequelize.define('ThreePID', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  provider: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  tpid: {
    type: DataTypes.CHAR(20),
    allowNull: false,
  },

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export default ThreePID;
