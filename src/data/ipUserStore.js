/*
 * storage of ip and user info
 */
import Sequelize, { QueryTypes, Op } from 'sequelize';

import sequelize from './sql/sequelize';
import {
  IP, Range, WhoisReferral, Ban,
} from './sql';
import {
  cacheIpAllowed,
  getCacheIpAllowed,
  cacheUserAllowed,
  getCacheUserAllowed,
} from './redis/isAllowedCache';

/*
 * Get stored country and proxycheck of ip
 * Returns minimal basics and allows conclusions on what ip data is missing
 * @param ip IP as string
 * @return {
 *   country, (two letter country code if range exists)
 *   proxy, (1 for proxy, 0 if not, null if not checked)
 *   rid, (id of range, set if range exists)
 *   whoisHost, (set if range doesn't exist and we know what host to whois)
 * }
 */
export async function getStoredCcAndPc(ip) {
  try {
    const ccandpc = await sequelize.query(
      'CALL CC_AND_PC_OF_IP($1)',
      {
        bind: [ip],
        type: QueryTypes.SELECT,
        raw: true,
        plain: true,
      },
    );
    console.log('CCANDPC', ccandpc);
    if (ccandpc.needsLink) {
      try {
        await IP.update({
          rid: ccandpc.rid,
        }, {
          where: { ip: Sequelize.fn('IP_TO_BIN', ip) },
        });
      } catch (err) {
        console.error(`SQL Error on linking range to ip: ${err.message}`);
      }
    }
    delete ccandpc.needsLink;
    return ccandpc;
  } catch (err) {
    console.error(`SQL Error on getStoredCcAndPc ${ip}: ${err.message}`);
    return {
      country: 'xx',
      proxy: -2,
      rid: -1,
      whoisHost: null,
    };
  }
}

/*
 * Get stored allowance of ip (proxy, whitelist and blacklist check)
 * Returns minimal basics and allows conclusions on what ip data is missing
 * @param ip IP as string
 * @return {
 *   status,
 *     -3: not yet checked
 *     -2: proxycheck failure
 *     -1: whitelisted
 *      0: allowed, no proxy
 *      1: is proxy
 *      2: is banned
 *      3: is rangebanned
 *   proxy, (1 for proxy, 0 if not, null if not checked)
 *   rid, (id of range, nuff if range doesn't exists)
 *   whoisHost, (set if range doesn't exist and we know what host to whois)
 * }
 */
export async function getStoredIpAllowance(ip) {
  try {
    const ipall = await sequelize.query(
      'CALL GET_IP_ALLOWANCE($1)',
      {
        bind: [ip],
        type: QueryTypes.SELECT,
        raw: true,
        plain: true,
      },
    );
    console.log('IPALLOW', ipall);
    if (ipall.needsLink) {
      try {
        await IP.update({
          rid: ipall.rid,
        }, {
          where: { ip: Sequelize.fn('IP_TO_BIN', ip) },
        });
      } catch (err) {
        console.error(`SQL Error on linking range to ip: ${err.message}`);
      }
    }
    delete ipall.needsLink;
    cacheIpAllowed(ip, ipall.status);
    return ipall;
  } catch (err) {
    console.error(`SQL Error on getStoredIpAllowance ${ip}: ${err.message}`);
    return {
      status: -2,
      proxy: -2,
      rid: -1,
      whoisHost: null,
    };
  }
}

/*
 * same as getStoredIpAllowance, just that we check redis cache first
 */
export async function getCachedIpAllowance(ip) {
  const cachedAllowance = await getCacheIpAllowed(ip);
  if (cachedAllowance !== null) {
    return {
      status: cachedAllowance,
      proxy: -2,
      rid: -1,
      whoisHost: null,
    };
  }
  return getStoredIpAllowance(ip);
}

/*
 * Get all bans that apply to a user
 * @param uid numerical user id
 * @return Array of bans with { reason, expires, mod: { name, id } }
 */
export async function getUserBans(uid) {
  try {
    const bans = await Ban.findAll({
      attributes: ['reason', 'expires'],
      where: {
        [Op.or]: [{
          '$tpids.user.id$': uid,
        }, {
          '$users.id$': uid,
        }],
      },
      include: [{
        association: 'tpids',
        include: [{
          association: 'user',
          // TODO check if we need to set this
          // attributes: [],
        }],
      }, {
        association: 'users',
        // attributes: [],
      }, {
        association: 'mod',
        attributes: ['name', 'id'],
      }],
      raw: true,
    });
    console.log('BANLIST', bans);
    // TODO clean up expired bans here
    cacheUserAllowed((bans.length) ? 1 : 0);
    return bans;
  } catch (err) {
    console.error(
      `SQL Error on getUserBans ${uid}: ${err.message}`,
    );
    return [];
  }
}

export async function getStoredUserAllowance(uid) {
  const userBans = await getUserBans(uid);
  return !userBans.length;
}

/*
 * Get stored allowance of user (so if he isn't banned)
 * @param uid numerical user id
 * @return true if allowed, false if banned
 */
export async function getCachedUserAllowance(uid) {
  const cachedAllowance = await getCacheUserAllowed(uid);
  if (cachedAllowance !== null) {
    return (cachedAllowance <= 0);
  }
  return getUserBans(uid);
}

/*
 * store proxycheck result
 * @param ip IP as string
 * @param pcReturn object that proxycheck returns
 * @rid id of range
 */
export async function storePc(ip, pcReturn, rid = null) {
  const { status, pcheck } = pcReturn;
  try {
    await IP.upsert({
      ip: Sequelize.fn('IP_TO_BIN', ip),
      proxy: status,
      pcheck,
      checkedAt: new Date(),
      rid,
    });
  } catch (err) {
    console.error(`SQL Error on storePc ${ip}: ${err.message}`);
  }
}

/*
 * store shois referral
 * @param host host we got referred to
 * @param range range
 */
export async function storeWhoisReferral(host, range) {
  try {
    await WhoisReferral.upsert({
      min: Sequelize.fn('UNHEX', range[0]),
      max: Sequelize.fn('UNHEX', range[1]),
      mask: range[2],
      host,
    });
  } catch (err) {
    console.error(`SQL Error on storeWhoisReferral ${host}: ${err.message}`);
  }
}

/*
 * store only whois data, don't set ip
 * If conflicting, delete whatever is there
 * @param whoisReturn object that whois returns
 */
async function storeOnlyWhois(whoisReturn) {
  const {
    range, org, descr, asn, country,
  } = whoisReturn;
  let tries = 0;
  while (true) {
    try {
      const { id } = await Range.create({
        min: Sequelize.fn('UNHEX', range[0]),
        max: Sequelize.fn('UNHEX', range[1]),
        mask: range[2],
        country,
        org,
        descr,
        asn,
      }, {
        raw: true,
      });
      return id;
    } catch (err) {
      if (tries > 0) {
        throw err;
      }
      // eslint-disable-next-line max-len
      console.warn(`SQL Error on storeOnlyWhois: ${err.message}, ${range}, assume that whois already exists and delete it`);
      await Range.delete({
        where: {
          [Op.or]: [{
            min: Sequelize.fn('UNHEX', range[0]),
          }, {
            max: Sequelize.fn('UNHEX', range[1]),
          }],
        },
        limit: 1,
      });
      tries += 1;
    }
  }
}

/*
 * store whois result
 * @param ip IP as string
 * @param whoisReturn object that whois returns
 */
export async function storeWhois(ip, whoisReturn) {
  const {
    range, org, descr, asn, country,
  } = whoisReturn;
  try {
    const rid = await storeOnlyWhois(whoisReturn);
    await IP.update({
      rid,
    }, {
      where: {
        ip: Sequelize.fn('IP_TO_BIN', ip),
      },
    });
  } catch (err) {
    console.error(`SQL Error on storeWhois ${ip}: ${err.message}`);
  }
}

/*
 * store both whois and proxycheck result
 * @param ip IP as string
 * @param whoisAndPc object with whois and pc return
 */
export async function storeWhoisAndPc(ip, whoisAndPc) {
  const {
    staus, pcheck,
    range, org, descr, asn, country,
  } = whoisAndPc;
  try {
    const rid = await storeOnlyWhois(whoisAndPc);
    await IP.upsert({
      ip: Sequelize.fn('IP_TO_BIN', ip),
      proxy: status,
      pcheck,
      checkedAt: new Date(),
      rid,
    });
  } catch (err) {
    console.error(`SQL Error on storeWhoisAndPc ${ip}: ${err.message}`);
  }
}
