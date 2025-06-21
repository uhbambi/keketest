import Sequelize, { DataTypes, Op } from 'sequelize';
import crypto from 'crypto';

import sequelize from './sequelize';
import RangeData from './Range';
import ProxyData from './Proxy';
import WhoisReferral from './WhoisReferral';

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
    allowNull: false,
    unique: true,
    defaultValue: () => {
      return crypto.randomBytes(16);
    }
  },

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * Get basic values to check if an ip is allows, may throw Error
 * @param ipString ip as string
 * @return {
 *   lastSeen,
 *   isWhitelisted,
 *   isProxy,
 *   bans: [ { expires, flags } ],
 *   country: two letter country code,
 *   whoisExpiresTs: timestamp for when whois expires,
 *   proxyCheckExpiresTs: timestamp for when proxycheck expires,
 * }
 */
export async function getIPAllowance(ipString) {
  let ipAllowance;
  try {
    ipAllowance = await IP.findOne({
      attributes: [
        'lastSeen',
        [Sequelize.literal('whitelist.ip IS NOT NULL'), 'isWhitelisted'],
        [Sequelize.col('proxy.isProxy'), 'isProxy'],
        [Sequelize.col('range.country'), 'country'],
        [Sequelize.col('range.expires'), 'whoisExpires'],
        [Sequelize.col('proxy.expires'), 'proxyCheckExpires'],
      ],
      where: { ip: Sequelize.fn('IP_TO_BIN', ipString) },
      include: [{
        association: 'range',
        attributes: [],
        where: {
          expires: { [Op.gt]: Sequelize.fn('NOW') },
        },
      }, {
        association: 'proxy',
        attributes: [],
        where: {
          expires: { [Op.gt]: Sequelize.fn('NOW') },
        },
      }, {
        association: 'whitelist',
        attributes: [],
      }, {
        association: 'bans',
        attributes: ['expires', 'flags'],
        where: {
          [Op.or]: [
            { expires: { [Op.gt]: Sequelize.fn('NOW') } },
            { expires: null },
          ],
        },
      }],
      raw: true,
      nested: true,
    });
    if (ipAllowance) {
      if (ipAllowance.whoisExpires) {
        ipAllowance.whoisExpiresTs = ipAllowance.whoisExpires.getTime();
        delete ipAllowance.whoisExpires;
      }
      if (ipAllowance.proxyCheckExpires) {
        // eslint-disable-next-line max-len
        ipAllowance.proxyCheckExpiresTS = ipAllowance.proxyCheckExpires.getTime();
        delete ipAllowance.proxyCheckExpires;
      }
    }
    console.log('TODO IP ALLOWANCE', JSON.stringify(ipAllowance));
  } catch (error) {
    console.error(`SQL Error on getIPAllowance: ${error.message}`);
  }

  /* making sure defaults are sane */
  if (!ipAllowance) {
    ipAllowance = {
      isWhitelisted: false,
      bans: [],
    };
  }
  ipAllowance.isProxy ??= false;
  ipAllowance.country ??= 'xx';
  /*
   * if an sql error occured above, it might be possible for the IP to get
   * stuck in a isWhitelisted: false, isBanned: false state, as fetching
   * whois and proxycheck will not refresh those values (nor should it do that,
   * unless there is ever an issue justifying it).
   */
  const currentTs = Date.now();
  ipAllowance.lastSeen ??= new Date();
  ipAllowance.whoisExpires ??= currentTs;
  ipAllowance.proxyCheckExpires ??= currentTs;

  return ipAllowance;
}

/**
 * Save ip information. If woisData or pcData aren't available, don't save
 * the specific one. Data objects need to have an expiration date.
 * If whoisData has an rid, don't write new whois data, but use that rid
 * @param ipString ip as string
 * @param whoisData null | {
 *   [rid]: id of range,
 *   expiresTs: timestamp when data expires,
 *   range as [start: hex, end: hex, mask: number],
 *   org as string,
 *   descr as string,
 *   asn as unsigned 32bit integer,
 *   country as two letter lowercase code,
 *   referralHost as string,
 *   referralRange as [start: hex, end: hex, mask: number],
 * }
 * @param pcData null | {
 *   expiresTs: timestamp when data expires,
 *   isProxy: true or false,
 *   type: Residential, Wireless, VPN, SOCKS,...,
 *   operator: name of proxy operator if available,
 *   city: name of city,
 *   devices: amount of devices using this ip,
 *   subnetDevices: amount of devices in this subnet,
 * }
 * @return success boolean
 */
export async function saveIPIntel(ipString, whoisData, pcData) {
  try {
    const transaction = await sequelize.transaction();

    try {
      const promises = [];
      let { rid } = whoisData;

      if (whoisData && !rid) {
        const {
          range, org, descr, country, asn, referralHost, referralRange,
          expiresTs: whoisExpiresTs,
        } = whoisData;

        if (referralRange && referralHost) {
          promises.push(WhoisReferral.upsert({
            min: Sequelize.fn('UNHEX', referralRange[0]),
            max: Sequelize.fn('UNHEX', referralRange[1]),
            mask: referralRange[2],
            host: referralHost,
            expires: new Date(whoisExpiresTs),
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
          expires: new Date(whoisExpiresTs),
        }, { transaction }));

        const whoisResult = await Promise.all(promises);
        rid = whoisResult[whoisResult.length - 1][0].id;
      }

      await IP.upsert({
        rid,
        ip: Sequelize.fn('IP_TO_BIN', ipString),
      }, { returning: false, transaction });

      if (pcData) {
        const query = {
          ...pcData,
          ip: Sequelize.fn('IP_TO_BIN', ipString),
        };
        query.expires = new Date(query.expiresTs);
        delete query.expires;

        await ProxyData.upsert(query, { returning: false, transaction });
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

/**
 * update lastSeen timestamps of IP
 * @param ipString ip as string
 */
export async function touchIP(ipString) {
  try {
    await IP.update({ lastSeen: Sequelize.fn('NOW') }, {
      where: { ip: Sequelize.fn('IP_TO_BIN', ipString) },
    });
  } catch (error) {
    console.error(`SQL Error on touchIP: ${error.message}`);
  }
}

/**
 * get IP of IID (which is just the uuid in this table)
 * @param uuid IID as String
 * @return null | uuid as String
 */
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
    return result?.ip;
  } catch (err) {
    console.error(`SQL Error on getIPofIID: ${err.message}`);
  }
  return null;
}

/**
 * get IID of IP (which is just the uuid in this table)
 * @param ipString ip as String
 * @return null | uuid as String
 */
export async function getIIDofIP(ipString) {
  try {
    const result = await IP.findOne({
      attributes: [
        [Sequelize.fn('BIN_TO_UUID', Sequelize.col('uuid')), 'uuid'],
      ],
      where: {
        ip: Sequelize.fn('IP_TO_BIN', ipString),
      },
      raw: true,
    });
    return result?.uuid;
  } catch (err) {
    console.error(`SQL Error on getIIDofIP: ${err.message}`);
  }
  return null;
}

/**
 * get IPs of IIDs (which is just the uuid in this table)
 * @param uuid Array of IID strings
 * @return Array of IPs
 */
export async function getIPsofIIDs(uuids) {
  if (!uuids?.length) {
    return null;
  }
  try {
    const result = await IP.findAll({
      attributes: [
        [Sequelize.fn('BIN_TO_IP', Sequelize.col('ip')), 'ip'],
      ],
      where: {
        uuid: uuids.map((uuid) => Sequelize.fn('UUID_TO_BIN', uuid)),
      },
      raw: true,
    });
    if (result) {
      return result.map((m) => m.ip);
    }
  } catch (err) {
    console.error(`SQL Error on getIPsofIIDs: ${err.message}`);
  }
  return null;
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
  } catch (error) {
    console.error(`SQL Error on getIdsToIps: ${error.message}`);
  }
  return ipToIdMap;
}

/**
 * get basic informations of ip
 * @param ipOrIid ip as string or uuid
 */
export async function getInfoToIp(ipOrIid) {
  try {
    let where;
    if (ipOrIid.includes('-')) {
      /* uuid */
      where = { uuid: Sequelize.fn('UUID_TO_BIN', ipOrIid) };
    } else {
      where = { ip: Sequelize.fn('IP_TO_BIN', ipOrIid) };
    }
    return await IP.findOne({
      attributes: [
        [Sequelize.fn('BIN_TO_IP', Sequelize.col('ip')), 'ipString'],
        [Sequelize.fn('BIN_TO_UUID', Sequelize.col('uuid')), 'uuid'],
        [Sequelize.col('range.country'), 'country'],
        [Sequelize.fn('CONCAT',
          Sequelize.fn('BIN_TO_IP', Sequelize.col('$range.min$')),
          '/',
          Sequelize.col('range.mask'),
        ), 'cidr'],
        [Sequelize.col('range.org'), 'org'],
        [Sequelize.col('range.descr'), 'descr'],
        [Sequelize.col('range.asn'), 'asn'],
        [Sequelize.col('proxy.type'), 'type'],
        [Sequelize.col('proxy.isProxy'), 'isProxy'],
        [Sequelize.literal('whitelist.ip IS NOT NULL'), 'isWhitelisted'],
      ],
      include: [{
        association: 'range',
        attributes: [],
        where: {
          expires: { [Op.gt]: Sequelize.fn('NOW') },
        },
      }, {
        association: 'proxy',
        attributes: [],
        where: {
          expires: { [Op.gt]: Sequelize.fn('NOW') },
        },
      }, {
        association: 'whitelist',
        attributes: [],
      }],
      where,
      raw: true,
    });
  } catch (error) {
    console.error(`SQL Error on getInfoToIp: ${error.message}`);
  }
  return null;
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
        [Sequelize.col('range.country'), 'country'],
        [Sequelize.fn('CONCAT',
          Sequelize.fn('BIN_TO_IP', Sequelize.col('range.min')),
          '/',
          Sequelize.col('range.mask'),
        ), 'cidr'],
        [Sequelize.col('range.org'), 'org'],
        [Sequelize.col('proxy.type'), 'pcheck'],
      ],
      include: [{
        association: 'range',
        attributes: [],
        where: {
          expires: { [Op.gt]: Sequelize.fn('NOW') },
        },
      }, {
        association: 'proxy',
        attributes: [],
        where: {
          expires: { [Op.gt]: Sequelize.fn('NOW') },
        },
      }],
      where: { ip: ips.map((ip) => Sequelize.fn('IP_TO_BIN', ip)) },
      raw: true,
    });
    result.forEach((obj) => {
      ipToIdMap.set(obj.ip, obj);
    });
  } catch (error) {
    console.error(`SQL Error on getIdsToIps: ${error.message}`);
  }
  return ipToIdMap;
}

export default IP;
