/*
 * get whois cached in SQL
 */

import logger from './logger';
import whoisIp from '../utils/whois';
import { rangeToString } from '../utils/ip';
import { setWhoisIdToIp } from '../data/sql/IP';
import { getRangeOfIp, saveIpRange } from '../data/sql/Range';
import { saveWhoisReferral } from '../data/sql/WhoisReferral';

/*
 * treat whois data always for whole ip ranges,
 * save them in the database and use them from there
 * if possible
 */
export default async function cachedWhoisIp(ip) {
  const rangeq = await getRangeOfIp(ip);
  console.log('WHOIS RANGEQ:', rangeq);
  // TODO: i don't think that it's returned like this
  // TODO: make sure data is purged after a month with IP associations
  if (rangeq?.cidr) {
    return rangeq;
  }
  let whoisData;
  if (rangeq?.host) {
    const { host } = rangeq;
    logger.info(`WHOIS for ${ip} through ${host}`);
    whoisData = await whoisIp(ip, { host });
  } else {
    logger.info(`WHOIS for ${ip}`);
    whoisData = await whoisIp(ip);
  }
  const {
    referralHost,
    range,
    org,
    descr,
    asn,
  } = whoisData;
  const country = whoisData.country || 'xx';
  if (referralHost && rangeq?.host !== referralHost) {
    /*
     * the last used host for whois is cached
     * to improve time and to avoid getting rate limited
     */
    saveWhoisReferral(whoisData.referralRange, referralHost);
  }
  if (!range) {
    return null;
  }
  const wid = await saveIpRange(whoisData);
  if (!wid) {
    return null;
  }
  return {
    wid,
    cidr: rangeToString(range),
    country,
    org,
    descr,
    asn,
  };
}
