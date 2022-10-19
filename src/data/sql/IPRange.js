import Sequelize, { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize';

/*
 * Information of IP Ranges from whois,
 * min and max are the upper and lower bound of IPs within the range,
 * stored in the same 64bit format as IP in IPInfo.js
 *
 * Will be kept indefinitelly, updated regularly
 */
const IPRange = sequelize.define('IPRange', {
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
  },

  org: {
    type: `${DataTypes.STRING(60)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    set(value) {
      this.setDataValue('org', value.slice(0, 60));
    },
  },

  descr: {
    type: `${DataTypes.STRING(60)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    set(value) {
      this.setDataValue('descr', value.slice(0, 60));
    },
  },

  asn: {
    type: DataTypes.INTEGER.UNSIGNED,
  },

  checkedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * Checks if range that includes ip exists,
 * If it exists, updates the IPInfos table to associate the IP to this ranges
 * Procedure got declared in ./sequelize.js
 * @param ip as string
 * @return {
 *   wid as number,
 *   cidr as string,
 *   asn as number,
 *   cuntry as two letter lowercase code,
 *   org as string,
 *   descr as string,
 * } if exists or {
 *   host as string (whois host to query)
 * } if whois host is known or null if not
 */
export async function getRangeOfIp(ip) {
  try {
    // return cidr, country, org, descr, asn, checkedAt
    const rangeq = sequelize.query(
      'CALL RANGE_OF_IP($1)',
      {
        bind: [ip],
        type: QueryTypes.SELECT,
        raw: true,
        plain: true,
      },
    );
    return rangeq;
  } catch (err) {
    console.error(`SQL Error on getRangeOfIp: ${err.message}`);
  }
  return null;
}

/**
 * Save whois data to range
 * @param whoisData
 * @return id if successful, null if not
 */
export async function saveIpRange(whoisData) {
  const {
    range, country, org, descr, asn,
  } = whoisData;
  try {
    const [rangeq] = await IPRange.upsert({
      min: Sequelize.fn('UNHEX', range[0]),
      max: Sequelize.fn('UNHEX', range[1]),
      mask: range[2],
      country,
      org,
      descr,
      asn,
      checkedAt: new Date(),
    });
    return rangeq.id;
  } catch (err) {
    console.error(`SQL Error on saveIpRange: ${err.message}`);
  }
  return null;
}

export default IPRange;
