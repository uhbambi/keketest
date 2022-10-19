import Sequelize, { DataTypes } from 'sequelize';

import sequelize from './sequelize';

const IPInfo = sequelize.define('IPInfo', {
  /*
   * Store both 32bit IPv4 and first half of 128bit IPv6
   * (only the first 64bit of a v6 is usually assigned
   * to customers by ISPs, the second half is assigned by devices)
   * NOTE:
   * IPv6 addresses in the ::/32 subnet would map to IPv4, which
   * should be no issues, because ::/8 is reserved by IETF
   */
  ip: {
    type: 'VARBINARY(8)',
    primaryKey: true,
  },

  uuid: {
    type: 'BINARY(16)',
    defaultValue: Sequelize.literal('UUID_TO_BIN(UUID())'),
    allowNull: false,
  },

  /*
   * 0: no proxy
   * 1: proxy
   */
  proxy: {
    type: DataTypes.TINYINT,
  },

  /*
   * extra information from
   * proxycheck
   */
  pcheck: {
    type: `${DataTypes.STRING(60)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    set(value) {
      if (value) {
        this.setDataValue('pcheck', value.slice(0, 60));
      }
    },
  },

  /*
   * time of last proxycheck
   */
  checkedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },

  /*
   * virtual field to get a boolean for proxy,
   * is not set in database
   */
  isProxy: {
    type: DataTypes.VIRTUAL,
    get() {
      return (this.proxy === 1);
    },
    set() {
      throw new Error(
        'Do not try to set the `isProxy` value! Set proxy instead',
      );
    },
  },
});

export async function getIPofIID(uuid) {
  if (!uuid) {
    return null;
  }
  try {
    const result = await IPInfo.findOne({
      attributes: [
        [Sequelize.fn('BIN_TO_IP', Sequelize.col('ip')), 'ip'],
      ],
      where: {
        uuid: Sequelize.fn('UUID_TO_BIN', uuid),
      },
      raw: true,
    });
    return result.ip;
  } catch (err) {
    console.error(`SQL Error on getIPofIID: ${err.message}`);
    return null;
  }
}

export async function getIIDofIP(ip) {
  try {
    const result = await IPInfo.findOne({
      attributes: [
        [Sequelize.fn('BIN_TO_UUID', Sequelize.col('uuid')), 'uuid'],
      ],
      where: {
        ip: Sequelize.fn('IP_TO_BIN', ip),
      },
      raw: true,
    });
    return result?.uuid;
  } catch (err) {
    console.error(`SQL Error on getIIDofIP: ${err.message}`);
    return null;
  }
}

export async function getIdsToIps(ips) {
  const ipToIdMap = new Map();
  if (!ips.length || ips.length > 300) {
    return ipToIdMap;
  }
  try {
    const result = await IPInfo.findAll({
      attributes: [
        [Sequelize.fn('BIN_TO_IP', Sequelize.col('ip')), 'ip'],
        [Sequelize.fn('BIN_TO_UUID', Sequelize.col('uuid')), 'uuid'],
      ],
      where: { ip: ips.map((ip) => Sequelize.fn('IP_TO_BIN', ip)) },
      raw: true,
    });
    result.forEach((obj) => {
      ipToIdMap.set(obj.ip, obj.uuid);
    });
  } catch (err) {
    console.error(`SQL Error on getIdsToIps: ${err.message}`);
  }
  return ipToIdMap;
}

export async function getInfoToIp(ip) {
  return IPInfo.findByPk(Sequelize.fn('IP_TO_BIN', ip));
}

export async function getInfoToIps(ips) {
  const ipToIdMap = new Map();
  if (!ips.length || ips.length > 300) {
    return ipToIdMap;
  }
  try {
    const result = await IPInfo.findAll({
      attributes: [
        [Sequelize.fn('BIN_TO_IP', Sequelize.col('ip')), 'ip'],
        [Sequelize.fn('BIN_TO_UUID', Sequelize.col('uuid')), 'uuid'],
        'country',
        'cidr',
        'org',
        'pcheck',
      ],
      where: { ip: ips.map((ip) => Sequelize.fn('IP_TO_BIN', ip)) },
      raw: true,
    });
    result.forEach((obj) => {
      ipToIdMap.set(obj.ip, obj);
    });
  } catch {
    // nothing
  }
  return ipToIdMap;
}

export default IPInfo;
