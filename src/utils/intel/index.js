/*
 * Tools for investigation IP and EMail addresses
 */

import socketEvents from '../socket/socketEvents';

import { queue, queueWithDelay } from './queue';
import {
  getStoredCcAndPc,
  getStoredIpAllowance,
  getCachedIpAllowance,
  getStoredUserAllowance,
  getCachedUserAllowance,
  storePc,
  storeWhois,
  storeWhoisAndPc,
  storeWhoisReferral,
} from '../../data/ipUserStore';
import ProxyCheck from './ProxyCheck';
import whois from './whois';
import { proxyLogger as logger } from './logger';
import { USE_PROXYCHECK, PROXYCHECK_KEY } from '../../core/config';

let checker = () => ({ status: 0, pcheck: 'dummy' });
let mailChecker = () => false;

if (USE_PROXYCHECK && PROXYCHECK_KEY) {
  const pc = new ProxyCheck(PROXYCHECK_KEY, logger);
  checker = pc.checkIp;
  mailChecker = pc.checkEmail;
}

async function doProxyCheck(ip, rid) {
  const pcReturn = await checker(ip);
  storePc(ip, pcReturn, rid);
  return pcReturn;
}

async function doWhois(ip, whoisHost) {
  const whoisOptions = {};
  if (whoisHost) whoisOptions.host = whoisHost;

  const whoisReturn = await whois(ip, whoisHost);
  if (whoisReturn.referralHost !== whoisHost) {
    storeWhoisReferral(whoisReturn.referralHost, whoisReturn.referralRange);
  }
  storeWhois(ip, whoisReturn);
  return whoisReturn;
}

async function doWhoisAndProxyCheck(ip, whoisHost) {
  const whoisOptions = {};
  if (whoisHost) whoisOptions.host = whoisHost;

  const [
    pcReturn,
    whoisReturn,
  ] = await Promise.all([
    checker(ip),
    whois(ip, whoisOptions),
  ]);
  if (whoisReturn.referralHost !== whoisHost) {
    storeWhoisReferral(whoisReturn.referralHost, whoisReturn.referralRange);
  }
  const ret = {
    ...pcReturn,
    ...whoisReturn,
  };
  storeWhoisAndPc(ip, ret);
  return ret;
}

// queues with 5s grace period
const doQueuedProxyCheck = queueWithDelay(doProxyCheck);
const doQueuedWhois = queueWithDelay(doWhois);
const doQueuedWhoisAndProxyCheck = queueWithDelay(doWhoisAndProxyCheck);
// ordinary queues
const getQueuedStoredCcAndPc = queue(getStoredCcAndPc);
const getQueuedCachedIpAllowance = queue(getCachedIpAllowance);
const getQueuedCachedUserAllowance = queue(getCachedUserAllowance);

/*
 * get country code of ip,
 * populate intel data when needed
 * @param ip IP as string
 * @return two letter country code
 */
export async function getCc(ip) {
  const {
    country,
    proxy,
    rid,
    whoisHost,
  } = await getQueuedStoredCcAndPc(ip);
  if (country) {
    if (proxy === null) {
      doQueuedProxyCheck(ip, rid);
    }
    return country;
  }
  let vals;
  if (proxy === null) {
    vals = await doQueuedWhoisAndProxyCheck(ip, whoisHost);
  }
  vals = await doWhois(ip, whoisHost);
  return vals.country || 'xx';
}

/*
 * check if ip is allowed
 * @param IPas string
 * @param cached if we get value from redis cache
 * @return status
 *   -3: not yet checked
 *   -2: proxycheck failure
 *   -1: whitelisted
 *    0: allowed, no proxy
 *    1: is proxy
 *    2: is banned
 *    3: is rangebanned
 */
export async function getIpAllowance(ip, cached = true) {
  let isall;
  if (cached) {
    isall = await getQueuedCachedIpAllowance(ip);
  } else {
    isall = await getStoredIpAllowance(ip),
  }
  const {
    status,
    proxy,
    rid,
    whoisHost,
  } = isall;
  if (proxy === null && rid === null) {
    doQueuedWhoisAndProxyCheck(ip, whoisHost);
  } else if (rid === null) {
    doQueuedWhois(ip, whoisHost);
  } else if (proxy === null) {
    doQueuedProxyCheck(ip, rid);
  }
  return status;
}

/*
 * check if user is allowed (not banned)
 * @param uid user id as number
 * @param cached if we get value from redis cache
 * @return true if allowed, false if banned
 */
export async function getUserAllowance(uid, cached = true) {
  if (cached) {
    return getQueuedCachedUserAllowance(uid);
  }
  return getStoredUserAllowance(uid);
}

export async function getIpUserIntel() {
}

export async function isIpUserAllowed() {
}

export function seenIP() {
}

export function seenIpUser() {
}
