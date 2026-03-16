/*
 *
 * Junction table for User -> Factions
 *
 */

import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const UserFaction = sequelize.define('UserFaction', {
  joined: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  /*
   * from lowest to highest bit
   * 0: hide from menu
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
});

export default UserFaction;
