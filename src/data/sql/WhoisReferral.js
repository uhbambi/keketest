import Sequelize, { DataTypes, Op } from 'sequelize';
import sequelize from './sequelize';

/*
 * Information of whois hosts responsible for Ranges,
 * min and max are the upper and lower bound of IPs within the range,
 * stored in the same 64bit format as IP in IP.js
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

  host: {
    type: DataTypes.STRING(60),
    allowNull: false,
  },

  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

/**
 * Get whois server for ip
 * @param ipString ip as string
 * @return null | host
 */
export async function getWhoisHostOfIP(ipString) {
  try {
    const range = await Range.findOne({
      attributes: ['host'],
      where: {
        min: { [Op.lte]: Sequelize.fn('IP_TO_BIN', ipString) },
        max: { [Op.gte]: Sequelize.fn('IP_TO_BIN', ipString) },
        expires: { [Op.gt]: Sequelize.fn('NOW') },
      },
      raw: true,
    });
    if (range) {
      return range.host;
    }
  } catch (error) {
    console.error(`SQL Error on getRangeOfIP: ${error.message}`);
  }
  return null;
}

export default WhoisReferral;
