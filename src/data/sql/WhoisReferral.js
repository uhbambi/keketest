import Sequelize, { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize';

/*
 * Information of whois hosts responsible for IPRanges,
 * min and max are the upper and lower bound of IPs within the range,
 * stored in the same 64bit format as IP in IPInfo.js
 *
 * Will be kept indefinitelly, updated regularly
 */
const WhoisReferral = sequelize.define('WhoisReferral', {
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

  host: {
    type: DataTypes.STRING(60),
    allowNull: false,
  },

  checkedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function getWhoisReferraloOfIp(ip) {
  try {
    // return cidr, country, org, descr, asn, checkedAt
    const rangeq = sequelize.query(
      'CALL WHOIS_REFERRAL_OF_IP($1)',
      {
        bind: [ip],
        type: QueryTypes.SELECT,
        raw: true,
        plain: true,
      },
    );
    return rangeq?.host;
  } catch (err) {
    console.error(`SQL Error on getRangeOfIp: ${err.message}`);
  }
  return null;
}

export async function saveWhoisReferral(range, host) {
  try {
    const [rangeq] = await WhoisReferral.upsert({
      min: Sequelize.fn('UNHEX', range[0]),
      max: Sequelize.fn('UNHEX', range[1]),
      mask: range[2],
      host,
      checkedAt: new Date(),
    });
    return rangeq.id;
  } catch (err) {
    console.error(`SQL Error on saveIpRange: ${err.message}`);
  }
  return null;
}
