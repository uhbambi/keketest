import Sequelize, { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize';
import { getLowHexSubnetOfIp } from '../../utils/intel/ip';
import RangeData from './Range';
import WhoisReferral from './WhoisReferral';
import { WHOIS_DURATION, PROXYCHECK_DURATION } from '../../core/config';

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

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});


/**
 * Get basic values to check if an ip is allows, may throw Error
 * @param ip as string
 * @return null | {
 *   isWhitelisted,
 *   isBanned,
 *   isProxy,
 *   country: two letter country code,
 *   checkedAt: Date object for when whois expires,
 *   proxyCheckExpires: Date object for when proxycheck expires,
 * }
 */
export async function getIPAllowance(ip) {
  const ipAllowance = await IP.findOne({
    attributes: [
      [Sequelize.literal('whitelist.ip IS NOT NULL'), 'isWhitelisted'],
      [Sequelize.literal('bans.ip IS NOT NULL'), 'isBanned'],
      [Sequelize.col('proxy.isProxy'), 'isProxy'],
      [Sequelize.col('range.country'), 'country'],
      [Sequelize.col('range.expires'), 'whoisExpires'],
      [Sequelize.col('proxy.expires'), 'proxyCheckExpires'],
    ],
    where: { ip: Sequelize.fn('IP_TO_BIN', ip) },
    include: [{
      association: 'range',
      attributes: [],
      where: {
        expires: { [Op.lt]: Sequelize.fn('NOW') },
      },
    }, {
      association: 'proxy',
      attributes: [],
      where: {
        expires: { [Op.lt]: Sequelize.fn('NOW') },
      },
    }, {
      association: 'whitelist',
      attributes: [],
    }, {
      association: 'bans',
      attributes: [],
      limit: 1,
    }],
    raw: true,
  });
  console.log('TODO IP ALLOWANCE', JSON.stringify(ipAllowance));
  return ipAllowance;
}

/**
 * Save ip information
 * @param ip as string
 * @param whoisData null | {
 *   range as [start: hex, end: hex, mask: number],
 *   org as string,
 *   descr as string,
 *   asn as unsigned 32bit integer,
 *   country as two letter lowercase code,
 *   referralHost as string,
 *   referralRange as [start: hex, end: hex, mask: number],
 * }
 * @param pcData null | {
 *   isProxy: true or false,
 *   type: Residential, Wireless, VPN, SOCKS,...,
 *   operator: name of proxy operator if available,
 *   city: name of city,
 *   devices: amount of devices using this ip,
 * }
 * @return success boolean
 */
export async function saveIPIntel(ip, whoisData, pcData) {
  try {
    let whoisExpires = WHOIS_DURATION * 3600 * 1000;
    let proxyCheckExpires = PROXYCHECK_DURATION * 3600 * 1000;

    if (!whoisData) {
      const placeholderRange = getLowHexSubnetOfIp(ip);
      if (!placeholderRange) {
        throw new Error(`${ip} is not valid`);
      }
      whoisData = {
        range: placeholderRange,
      };
      whoisExpires = 24 * 3600 * 1000;
    }

    if (!pcData) {
      pcData = {
        isProxy: false,
      },
      proxyCheckExpires = 12 * 3600 * 1000;
    }

    const nowTs = Date.now();
    whoisExpires = new Date(nowTs + whoisExpires);
    proxyCheckExpires = new Date(nowTs + proxyCheckExpires);
    const promises = [];

    const transaction = await sequelize.transaction();

    const {
      range, org, descr, country, asn, referralHost, referralRange,
    } = whoisData;

    try {
      if (referralRange && referralHost) {
        promises.push(WhoisReferral.upsert({
          min: Sequelize.fn('UNHEX', referralRange[0]),
          max: Sequelize.fn('UNHEX', referralRange[1]),
          mask: referralRange[2],
          host: referralHost,
          expires: whoisExpires,
        }, { returning: false, transaction }));
      }

      promises.push(RangeData.upsert({
        min: Sequelize.fn('UNHEX', range[0]),
        max: Sequelize.fn('UNHEX', range[1]),
        mask: range[2],
        country,
        org,
        descr,
        asn,
        expires: whoisExpires,
      }, { transaction }));

      let result = await Promise.all(promises);
      const rid = result[result.length - 1][0].id;
      const {
        isProxy, type, operator, city, devices,
      } = pcData;

      result = await IP.upsert({
        ip: Sequelize.fn('IP_TO_BIN', ip),
      }, {
        include: [{
          association: 'proxy',
        }],
        transaction,
      });

      const proxy = {
        isProxy, type, operator, city, devices, expires: proxyCheckExpires,
      };
      if (result.proxy) {
        await result.setProxy(proxy, { transaction });
      } else {
        await result.createProxy(proxy, { transaction });
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`SQL Error on saveIPIntel: ${error.message}`);
  }
  return false;
}

export async function getIPIntel(ip) {
  try {
    const ipIntel= await IP.findOne({
      attributes: [
        'uuid',
        [Sequelize.literal('whitelist.ip IS NOT NULL'), 'isWhitelisted'],
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
      }, {
        association: 'whitelist',
        attributes: [],
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
