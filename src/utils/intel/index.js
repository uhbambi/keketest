/*
 * utils for informations regarding ip and email
 */
import ProxyCheck from './ProxyCheck.js';
import whois from './whois.js';
import socketEvents from '../../socket/socketEvents.js';
import { getLowHexSubnetOfIP } from './ip.js';
import { getRangeOfIP } from '../../data/sql/Range.js';
import { getWhoisHostOfIP } from '../../data/sql/WhoisReferral.js';
import { saveIPIntel } from '../../data/sql/IP.js';
import { queue } from './queue.js';
import {
  USE_PROXYCHECK, PROXYCHECK_KEY, WHOIS_DURATION, PROXYCHECK_DURATION,
} from '../../core/config.js';
import { DO_NOTHING } from '../../core/constants.js';

let proxyChecker = () => null;
let mailChecker = () => null;

if (USE_PROXYCHECK && PROXYCHECK_KEY) {
  const pc = new ProxyCheck(PROXYCHECK_KEY);
  proxyChecker = pc.checkIp;
  mailChecker = pc.checkEmail;
}

/**
 * get whois informatino of IP, lookup SQL for data first
 * return is euqal to whoisData, but with optional additional range id and
 * expires date
 * @param ipString ip as string
 * @return null | {
 *   [rid]: id of range,
 *   [expiresTs]: timestamp when data expires,
 *   range as [start: hex, end: hex, mask: number],
 *   org as string,
 *   descr as string,
 *   asn as unsigned 32bit integer,
 *   country as two letter lowercase code,
 *   referralHost as string,
 *   referralRange as [start: hex, end: hex, mask: number],
 * }
 */
async function whoisWithStorage(ipString) {
  /* request range from SQL first */
  let whoisData = await getRangeOfIP(ipString);
  if (whoisData) {
    if (whoisData.expires) {
      whoisData.expiresTs = whoisData.expires.getTime();
      delete whoisData.expires;
    }
    return whoisData;
  }
  const whoisOptions = {};
  /* check if we have a whois server stored */
  const host = await getWhoisHostOfIP(ipString);
  if (host) whoisOptions.host = host;
  whoisData = await whois(ipString, whoisOptions);
  return whoisData;
}

/**
 * Get IP intel (whois and proxycheck)
 * @param ipString ip as string
 * @param whoisNeeded if we shouldfetch whois
 * @param proxyCheckNeeded if we should fetch proxycheck
 * @return Promise<[null | {
 *   expiresTs: timestamp when data expires,
 *   range as [start: hex, end: hex, mask: number],
 *   org as string,
 *   descr as string,
 *   asn as unsigned 32bit integer,
 *   country as two letter lowercase code,
 *   referralHost as string,
 *   referralRange as [start: hex, end: hex, mask: number],
 * }, null | {
 *   expiresTs: timestamp when data expires,
 *   isProxy: true or false,
 *   type: Residential, Wireless, VPN, SOCKS,...,
 *   operator: name of proxy operator if available,
 *   city: name of city,
 *   devices: amount of devices using this ip,
 *   subnetDevices: amount of devices in this subnet,
 * }]>
 */
export const getIPIntel = queue(async (
  ipString, whoisNeeded, proxyCheckNeeded,
) => {
  /* if neither whois or proxycheck needed are given, get both */
  // eslint-disable-next-line eqeqeq
  if (whoisNeeded == null && proxyCheckNeeded == null) {
    whoisNeeded = true;
    proxyCheckNeeded = true;
  }

  let [whoisData, proxyCheckData] = await Promise.all([
    (whoisNeeded) ? whoisWithStorage(ipString) : null,
    (proxyCheckNeeded) ? proxyChecker(ipString) : null,
  ]);

  const nowTs = Date.now();

  /* if we couldn't fetch something, store placeholder */
  if (whoisNeeded && !whoisData) {
    const placeholderRange = getLowHexSubnetOfIP(ipString);
    if (!placeholderRange) {
      console.error(`${ipString} is not valid`);
    } else {
      whoisData = {
        range: placeholderRange,
        expiresTs: nowTs + 24 * 3600 * 1000,
      };
    }
  }
  if (proxyCheckNeeded && !proxyCheckData) {
    proxyCheckData = {
      isProxy: false,
      expiresTs: nowTs + 12 * 3600 * 1000,
    };
  }

  /* add expiration if not set */
  if (whoisData && !whoisData.expiresTs) {
    whoisData.expiresTs = nowTs + WHOIS_DURATION * 3600 * 1000;
  }
  if (proxyCheckData && !proxyCheckData.expiresTs) {
    proxyCheckData.expiresTs = nowTs + PROXYCHECK_DURATION * 3600 * 1000;
  }

  /* we don't have to await that */
  saveIPIntel(ipString, whoisData, proxyCheckData);

  if (whoisData?.rid) {
    delete whoisData.rid;
  }

  return [whoisData, proxyCheckData];
});

const disposableEmailDomainCache = {};

export const checkMail = queue(async (email) => {
  if (!email) {
    return false;
  }
  const domain = email.substring(email.lastIndexOf('@') + 1);
  const tld = domain.substring(domain.lastIndexOf('.') + 1);
  if (tld === 'sbs' || tld === 'cyou' || domain === 'fuckmeuwu.shop') {
    return true;
  }
  const cache = disposableEmailDomainCache[domain];
  if (cache) {
    return cache;
  }
  const isDisposable = await mailChecker(email);
  if (isDisposable) {
    disposableEmailDomainCache[domain] = true;
  }
  return isDisposable;
});

/*
 * the following is for shards,
 * only the main shard shall handle proxycheck and whois requests, other shards
 * request it from him and wait for an answer.
 */

/* answer on request if main shard */
socketEvents.onReq('ipintel', (...args) => {
  if (socketEvents.important) {
    console.log('PROXYCHECK ARGS', args);
    return getIPIntel(...args);
  }
  return DO_NOTHING;
});

socketEvents.onReq('mailintel', (...args) => {
  if (socketEvents.important) {
    console.log('MAILINTEL ARGS', args);
    return checkMail(...args);
  }
  return DO_NOTHING;
});

/* send request */
// eslint-disable-next-line max-len
export const getIPIntelOverShards = queue((...args) => socketEvents.req('ipintel', ...args));

// eslint-disable-next-line max-len
export const checkMailOverShards = queue((...args) => socketEvents.req('mailintel', ...args));
