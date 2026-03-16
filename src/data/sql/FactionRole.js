/*
 * Custom Roles of factions, those are like roles that the user can choose
 * from
 */

import { DataTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { FACTIONLVL } from '../../core/constants.js';

const FactionRole = sequelize.define('FactionRole', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  fid: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  /*
   * if null, users with this action role will show their geo flags or
   * choose their own
   */
  customFlag: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

  title: {
    type: `${DataTypes.STRING(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
  },

  /*
   * what user with role is allowed to do
   */
  factionlvl: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: FACTIONLVL.PEASANT,
  },
}, {
  indexes: [{
    name: 'role_fid',
    fields: ['fid'],
  }],
});

export default FactionRole;
