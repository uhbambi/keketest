import Sequelize, { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize';

const IP = sequelize.define('IP', {
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
   * time of last whois
   */
  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export async function getIPIntel(ip) {
  try {
    const ipIntel= await IP.findOne({
      attributes: [
        'uuid',
        [Sequelize.fn('CONCAT',
          Sequelize.fn('BIN_TO_IP', Sequelize.col('$range.min$')),
          '/',
          Sequelize.col('range.mask')
        ), 'cidr'],
        [Sequelize.col('range.country'), 'country'],
        [Sequelize.col('range.org'), 'org'],
        [Sequelize.col('range.descr'), 'descr'],
        [Sequelize.col('range.asn'), 'asn'],
        [Sequelize.col('proxy.isProxy'), 'isProxy'],
        [Sequelize.col('proxy.type'), 'type'],
        [Sequelize.col('proxy.operator'), 'operator'],
        [Sequelize.col('proxy.devices'), 'devices'],
        [Sequelize.col('range.checkedAt'), 'lastWhois'],
        [Sequelize.col('proxy.checkedAt'), 'lastProxyCheck'],
      ],
      where: { ip: Sequelize.fn('IP_TO_BIN', ip) },
      include: [{
        association: 'range',
        attributes: [],
        where: {
          // min: { [Op.lte]: Sequelize.fn('IP_TO_BIN', ip) },
          // max: { [Op.gte]: Sequelize.fn('IP_TO_BIN', ip) },
          checkedAt: { [Op.gt]: Sequelize.literal('NOW() - INTERVAL 30 DAY') },
        },
      }, {
        association: 'proxy',
        attributes: [],
        where: {
          checkedAt: { [Op.gt]: Sequelize.literal('NOW() - INTERVAL 3 DAY') },
        },
      }],
      raw: true,
    });
  } catch (error) {
    console.error(`SQL Error on getIPIntel: ${error.message}`);
  }
}

export async function getIPofIID(uuid) {
  if (!uuid) {
    return null;
  }
  try {
    const result = await IP.findOne({
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
    const result = await IP.findOne({
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
    const result = await IP.findAll({
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
  return IP.findByPk(Sequelize.fn('IP_TO_BIN', ip));
}

export async function getInfoToIps(ips) {
  const ipToIdMap = new Map();
  if (!ips.length || ips.length > 300) {
    return ipToIdMap;
  }
  try {
    const result = await IP.findAll({
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

export default IP;
