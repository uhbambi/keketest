import Sequelize, { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize.js';
import { sanitizeIPString, ipToHex } from '../../utils/intel/ip.js';

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
    unique: 'min',
    allowNull: false,
  },

  max: {
    type: 'VARBINARY(8)',
    unique: 'max',
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

/**
 * look up range of IP, return is euqal to whoisData,
 * but with additional range id and expires date
 * @param ipString ip as string
 * @return null | {
 *   rid: id of range,
 *   expires: Date object when data expires,
 *   range as [start: hex, end: hex, mask: number],
 *   org as string,
 *   descr as string,
 *   asn as unsigned 32bit integer,
 *   country as two letter lowercase code,
 *   referralHost as string,
 *   referralRange as [start: hex, end: hex, mask: number],
 * }
 */
export async function getRangeOfIP(ipString) {
  try {
    const range = await RangeData.findOne({
      attributes: [
        'mask', 'country', 'org', 'descr', 'asn', 'expires',
        ['id', 'rid'],
        [Sequelize.fn('BIN_TO_IP', Sequelize.col('min')), 'min'],
        [Sequelize.fn('BIN_TO_IP', Sequelize.col('min')), 'max'],
      ],
      where: {
        min: { [Op.lte]: Sequelize.fn('IP_TO_BIN', ipString) },
        max: { [Op.gte]: Sequelize.fn('IP_TO_BIN', ipString) },
        expires: { [Op.gt]: Sequelize.literal('NOW() - INTERVAL 20 DAY') },
      },
      raw: true,
    });
    if (range) {
      return {
        rid: range.rid,
        expires: range.expires,
        range: [
          ipToHex(sanitizeIPString(range.min)),
          ipToHex(sanitizeIPString(range.min)),
          range.mask,
        ],
        org: range.org,
        descr: range.descr,
        asn: range.asn,
        country: range.country,
      };
    }
  } catch (error) {
    console.error(`SQL Error on getRangeOfIP: ${error.message}`);
  }
  return null;
}

export default RangeData;
