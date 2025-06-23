import Sequelize, { DataTypes, QueryTypes, Op } from 'sequelize';
import crypto from 'crypto';

import sequelize, { nestQuery } from './sequelize.js';
import RangeData from './Range.js';
import ProxyData from './Proxy.js';
import WhoisReferral from './WhoisReferral.js';
import { USE_PROXYCHECK } from '../../core/config.js';

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
    unique: 'uuid',
    defaultValue: () => crypto.randomBytes(16),
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
    ipAllowance = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT COALESCE(i.lastSeen, NOW() - INTERVAL 5 MINUTE) as lastSeen,
COALESCE(p.isProxy, 0) AS isProxy, w.ip IS NOT NULL AS isWhitelisted,
COALESCE(r.country, 'xx') AS country,
COALESCE(r.expires, NOW() - INTERVAL 5 MINUTE) AS whoisExpires,
COALESCE(p.expires, NOW() - INTERVAL 5 MINUTE) AS proxyCheckExpires,
b.expires AS 'bans.expires', b.flags AS 'bans.flags' FROM IPs i
  LEFT JOIN ProxyWhitelists w ON w.ip = i.ip
  LEFT JOIN Proxies p ON p.ip = i.ip AND p.expires > NOW()
  LEFT JOIN Ranges r ON r.id = i.rid AND r.expires > NOW()
  LEFT JOIN IPBans ib ON ib.ip = i.ip
  LEFT JOIN Bans b ON b.id = ib.bid AND (b.expires > NOW() OR b.expires IS NULL)
WHERE i.ip = IP_TO_BIN(:ipString)`, {
      /* eslint-enable max-len */
        replacements: { ipString },
        raw: true,
        type: QueryTypes.SELECT,
      });
    ipAllowance = nestQuery(ipAllowance);

    if (ipAllowance) {
      ipAllowance.isProxy = ipAllowance.isProxy === 1;
      ipAllowance.isWhitelisted = ipAllowance.isWhitelisted === 1;
      ipAllowance.whoisExpiresTs = ipAllowance.whoisExpires.getTime();
      // eslint-disable-next-line max-len
      ipAllowance.proxyCheckExpiresTs = ipAllowance.proxyCheckExpires.getTime();
      delete ipAllowance.whoisExpires;
      delete ipAllowance.proxyCheckExpires;
    }
  } catch (error) {
    console.error(`SQL Error on getIPAllowance: ${error.message}`);
  }

  if (!ipAllowance) {
    const expiredTs = Date.now() - 10 * 3600 * 1000;

    ipAllowance = {
      isWhitelisted: false,
      bans: [],
      country: 'xx',
      isProxy: false,
      lastSeen: new Date(),
      whoisExpiresTs: expiredTs,
      proxyCheckExpiresTs: expiredTs,
    };
  }

  if (!USE_PROXYCHECK) {
    ipAllowance.proxyCheckExpiresTs = Infinity;
  }

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
        delete query.expiresTs;

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
 * @return null | {
 *   iid,
 *   ipString,
 *   country,
 *   cidr,
 *   org,
 *   descr,
 *   asn,
 *   type,
 *   isProxy,
 *   isWhitelisted,
 * }
 */
export async function getInfoToIp(ipOrIid) {
  try {
    let where;
    if (ipOrIid.includes('-')) {
      where = 'ip.uuid = UUID_TO_BIN(?)';
    } else {
      where = 'ip.ip = IP_TO_BIN(?)';
    }
    const ipInfo = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT ip.uuid AS 'iid', BIN_TO_IP(ip.ip) AS 'ipString',
COALESCE(r.country, 'xx') AS 'country', r.org, r.descr, r.asn, CONCAT(BIN_TO_IP(r.min), '/', r.mask) AS 'cidr',
p.type, COALESCE(p.isProxy, 0) AS isProxy, w.ip IS NOT NULL AS isWhitelisted
FROM IPs ip
  LEFT JOIN Ranges r ON r.id = ip.rid
  LEFT JOIN Proxies p ON p.ip = ip.ip
  LEFT JOIN ProxyWhitelists w ON w.ip = ip.ip
WHERE ${where}`, {
        /* eslint-enable max-len */
        replacements: [ipOrIid],
        raw: true,
        type: QueryTypes.SELECT,
      });
    if (ipInfo.length) {
      return ipInfo[0];
    }
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
