import Sequelize, { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize';

/*
 * Information of IP Ranges from whois,
 * min and max are the upper and lower bound of IPs within the range,
 * stored in the same 64bit format as IP in IP.js
 *
 * Will be kept indefinitelly, updated regularly
 */
const RangeData = sequelize.define('Range', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  min: {
    type: 'VARBINARY(8)',
    unique: true,
    allowNull: false,
  },

  max: {
    type: 'VARBINARY(8)',
    unique: true,
    allowNull: false,
  },

  mask: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  country: {
    type: DataTypes.CHAR(2),
    defaultValue: 'xx',
    allowNull: false,
    set(value) {
      if (value.length !== 2) {
        value = 'xx';
      }
      this.setDataValue('country', value.toLowerCase());
    },
  },

  org: {
    type: DataTypes.STRING(60),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    set(value) {
      if (value) this.setDataValue('org', value.slice(0, 60));
    },
  },

  descr: {
    type: DataTypes.STRING(60),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    set(value) {
      if (value) this.setDataValue('descr', value.slice(0, 60));
    },
  },

  asn: {
    type: DataTypes.INTEGER.UNSIGNED,
  },

  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default RangeData;
