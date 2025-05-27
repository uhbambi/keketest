/**
 *
 * Storing third party IDs for oauth login
 */

import { DataTypes } from 'sequelize';

import sequelize from './sequelize';

const ThreePIDHistory = sequelize.define('ThreePIDHistory', {
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
    type: DataTypes.STRING(80),
    allowNull: false,
  },

  normalizedTpid: {
    // eslint-disable-next-line max-len
    type: 'VARCHAR(80) GENERATED ALWAYS AS (NORMALIZE_TPID(provider, tpid)) STORED',
    set() {
      throw new Error('Do not try to set normalizedTpid. It is generated');
    },
  },

  verified: {
    type: DataTypes.BOOLEAN,
  },

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [{
    unique: true,
    fields: ['provider', 'tpid'],
  }, {
    unique: true,
    fields: ['provider', 'normalizedTpid'],
  }],
});

export default ThreePIDHistory
