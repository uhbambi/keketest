/*
 * factions
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';

const Faction = sequelize.define('Faction', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /* [a-zA-Z0-9._-] */
  name: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(32)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
    unique: 'name',
  },

  title: {
    type: `${DataTypes.STRING(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
  },

  description: {
    type: `${DataTypes.STRING(250)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
  },

  /*
   * faction chat channel,
   * user membership of those channels is still managed in UserChannels
   * seperately.
   * Factions are an addition to channels, not backed in.
   */
  cid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNll: false,
  },

  avatar: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

  /*
   * from lowest to highest bit, see FACTION_FLAGS:
   * 0: priv (if faction is private)
   * 1: public (if everybody can join without invite)
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [{
    name: 'faction_title',
    fields: ['title'],
  }],
});

export default Faction;
