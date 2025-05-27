/*
 * Get various data of IP and User and check if it is allowed to use site
 * or check if Email is dispoable
 * does proxycheck and check bans and whitelists
 * write IP and UserIP to database
 */
import { getIPv6Subnet } from '../utils/ip';
import whois from '../utils/whois';
import ProxyCheck from '../utils/ProxyCheck';
import { IP } from '../data/sql';
import { updateLastIp } from '../data/sql/UserIP';
import { isIPBanned } from '../data/sql/IPBan';
import { isWhitelisted } from '../data/sql/Whitelist';
import socketEvents from '../socket/socketEvents';
import {
  cacheAllowed,
  getCacheAllowed,
  cacheMailProviderDisposable,
  getCacheMailProviderDisposable,
} from '../data/redis/isAllowedCache';
import { proxyLogger as logger } from './logger';

import { USE_PROXYCHECK, PROXYCHECK_KEY } from './config';

// checker for IP address validity (proxy or vpn or not)
let checker = () => ({ allowed: true, status: 0, pcheck: 'dummy' });
// checker for mail address (disposable or not)
let mailChecker = () => false;

if (USE_PROXYCHECK && PROXYCHECK_KEY) {
  /*
   * TODO: go through main shard
   */
  const pc = new ProxyCheck(PROXYCHECK_KEY, logger);
  checker = pc.checkIp;
  mailChecker = pc.checkEmail;
}

/*
 * notify user update
 */
async function userIpUpdate(userIpData) {
  const {
    userId,
    ip,
    userAgent,
  } = userIpData;
  try {
    await updateLastIp(userId, ip, userAgent);
    socketEvents.gotUserIpInfo(userIpData);
  } catch (error) {
    logger.error(
      `Error on saving UserIP for ${ip} / ${userId}: ${error.message}`,
    );
  }
}

/*
 * save information of ip into database
 */
async function saveIP(ip, whoisRet, allowed, info, options) {
  try {
    await IP.upsert({
      ...whoisRet,
      ip,
      proxy: allowed,
      pcheck: info,
    });

    const { userId } = options;
    if (userId) {
      const userIpData = {
        ...whoisRet,
        ip,
        userId,
        userAgent: options.userAgent || null,
      };
      userIpUpdate(userIpData);
    }
  } catch (error) {
    logger.error(`Error whois for ${ip}: ${error.message}`);
  }
}

/**
 * execute proxycheck and blacklist whitelist check
 * @param f proxycheck function
 * @param ip full ip
 * @param ipKey IP cleared of IPv6Subnets
 * @return [ allowed, status, pcheck capromise]
 */
async function checkPCAndLists(f, ip, ipKey) {
  let allowed = true;
  let status = -2;
  let pcheck = null;

  try {
    if (await isWhitelisted(ipKey)) {
      allowed = true;
      pcheck = 'wl';
      status = -1;
    } else if (await isIPBanned(ipKey)) {
      allowed = false;
      pcheck = 'bl';
      status = 2;
    } else {
      const res = await f(ip);
      status = res.status;
      allowed = res.allowed;
      pcheck = res.pcheck;
    }
  } catch (err) {
    logger.error(`Error checkAllowed for ${ip}: ${err.message}`);
  }

  const caPromise = cacheAllowed(ipKey, status);
  return [allowed, status, pcheck, caPromise];
}

/**
 * execute proxycheck and whois and save result into cache
 * @param f function for checking if proxy
 * @param ip IP to check
 * @param ipKey IP cleared of IPv6Subnets
 * @param options see checkIfAllowed
 * @return checkifAllowed return
 */
async function withoutCache(f, ip, ipKey, options) {
  const [
    [allowed, status, pcheck, caPromise],
    whoisRet,
  ] = await Promise.all([
    checkPCAndLists(f, ip, ipKey),
    whois(ip),
  ]);

  await Promise.all([
    caPromise,
    saveIP(ipKey, whoisRet, status, pcheck, options),
  ]);

  return {
    allowed,
    status,
  };
}

/*
 * Array of running ip checks
 * [
 *   [ipKey, promise],
 *   [ipKey2, promise2],
 *   ...
 * ]
 */
const checking = [];
/**
 * Execute proxycheck and whois and save result into cache
 * If IP is already getting checked, reuse its request
 * @param ip ip to check
 * @param ipKey IP cleared of IPv6Subnets
 * @param options see checkIfAllowed
 * @return checkIfAllowed return
 */
async function withoutCacheButReUse(f, ip, ipKey, options) {
  const runReq = checking.find((q) => q[0] === ipKey);
  if (runReq) {
    return runReq[1];
  }
  const promise = withoutCache(f, ip, ipKey, options);
  checking.push([ipKey, promise]);

  const result = await promise;
  checking.splice(
    checking.findIndex((q) => q[0] === ipKey),
    1,
  );
  return result;
}

/**
 * execute proxycheck, don't wait, return cache if exists or
 * status -2 if currently checking
 * @param f function for checking if proxy
 * @param ip IP to check
 * @param ipKey IP cleared of IPv6Subnets
 * @param options see checkIfAllowed
 * @return Object as in checkIfAllowed
 * @return true if proxy or blacklisted, false if not or whitelisted
 */
async function withCache(f, ip, ipKey, options) {
  const runReq = checking.find((q) => q[0] === ipKey);

  if (!runReq) {
    const cache = await getCacheAllowed(ipKey);
    if (cache) {
      return cache;
    }
    withoutCacheButReUse(f, ip, ipKey, options);
  }

  return {
    allowed: true,
    status: -2,
  };
}

/**
 * check if ip is allowed, get IP informations and store them
 * @param ip IP
 * @param options {
 *   userId: id of user (if given, connect IP to user via UserIP table),
 *   userAgent: useragent string (for UserIP table ),
 *   disableCache: if we fetch result from cache,
 * }
 * @return Promise {
 *     allowed: boolean if allowed to use site
 * ,   status:  -2: not yet checked
 *              -1: whitelisted
 *              0: allowed, no proxy
 *              1  is proxy
 *              2: is banned
 *              3: is rangebanned
 *              4: invalid ip
 *   }
 */
export default function getIpUserIntel(ip, options = {}) {
  if (!ip) {
    return {
      allowed: false,
      status: 4,
    };
  }
  const ipKey = getIPv6Subnet(ip);

  if (options.disableCache) {
    return withoutCacheButReUse(checker, ip, ipKey, options);
  }
  return withCache(checker, ip, ipKey, options);
}

/**
 * check if email is disposable
 * @param email
 * @param disableCache if we fetch result from cache
 * @return Promise
 *   null: some error occurred
 *   false: legit provider
 *   true: disposable
 */
export async function checkIfMailDisposable(email, options = {}) {
  const mailProvider = email.slice(email.indexOf('@') + 1);
  if (!options.disableCache) {
    const cache = await getCacheMailProviderDisposable(mailProvider);
    if (cache !== null) {
      return cache;
    }
  }
  const isDisposable = await mailChecker(email);
  if (isDisposable !== null) {
    cacheMailProviderDisposable(mailProvider, isDisposable);
  }
  return isDisposable;
}
