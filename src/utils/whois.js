/*
 * get information from ip
 */

import net from 'net';

import { isIPv6, ipSubnetToHex } from './ip';
import { OUTGOING_ADDRESS } from '../core/config';

const WHOIS_PORT = 43;
const QUERY_SUFFIX = '\r\n';
const WHOIS_TIMEOUT = 10000;

/*
 * parse whois return into fields
 */
function parseSimpleWhois(whois) {
  let data = {
    groups: {},
  };
  const groups = [{}];
  const text = [];
  const lines = whois.split('\n');
  let lastLabel;

  for (let i = 0; i < lines.length; i += 1) {
    let line = lines[i].trim();
    if (line.startsWith('%') || line.startsWith('#')) {
      /*
       * detect if an ASN or IP has multiple WHOIS results,
       * and only care about first one
       */
      if (line.includes('# end')) {
        break;
      } else if (!lines.includes('# start')) {
        text.push(line);
      }
      continue;
    }
    if (line) {
      // strip network prefix for rwhois
      if (line.startsWith('network:')) {
        line = line.slice(8);
      }

      const sep = line.indexOf(':');
      if (~sep) {
        const label = line.slice(0, sep).toLowerCase();
        lastLabel = label;
        const value = line.slice(sep + 1).trim();
        // 1) Filter out unnecessary info, 2) then detect if the label is already added to group
        if (value.includes('---')) {
          // do nothing with useless data
        } else if (groups[groups.length - 1][label]) {
          groups[groups.length - 1][label] += `\n${value}`;
        } else {
          groups[groups.length - 1][label] = value;
        }
      } else {
        groups[groups.length - 1][lastLabel] += `\n${line}`;
      }
    } else if (Object.keys(groups[groups.length - 1]).length) {
      // if empty line, means another info group starts
      groups.push({});
    }
  }

  groups.forEach((group) => {
    if (group.role) {
      const role = group.role.replaceAll(' ', '-').toLowerCase();
      delete group.role;
      data.groups[role] = group;
    } else {
      data = {
        ...group,
        ...data,
      };
    }
  });

  data.text = text.join('\n');

  return data;
}

/*
 * parse whois return
 * @param ip ip string
 * @param whois whois return
 * @return object with whois data
 */
function parseWhois(ip, whoisReturn) {
  const data = {};
  if (!whoisReturn) {
    return data;
  }
  const whoisData = parseSimpleWhois(whoisReturn);

  let range = whoisData.inetnum || whoisData.inet6num || whoisData.cidr
      || whoisData.netrange || whoisData.route || whoisData.route6
      || whoisData['ip-network'] || whoisData['auth-area'];
  range = ipSubnetToHex(range, ip);
  if (range) data.range = range;
  let org = whoisData['org-name']
    || whoisData.organization
    || whoisData.orgname
    || whoisData.descr
    || whoisData['mnt-by'];
  if (!org) {
    const contactGroup = Object.keys(whoisData.groups).find(
      (g) => whoisData.groups[g].address,
    );
    if (contactGroup) {
      [org] = whoisData.groups[contactGroup].address.split('\n');
    } else {
      org = whoisData.owner || whoisData['mnt-by'];
    }
  }
  if (org) data.org = org;
  const descr = whoisData.netname || whoisData.descr;
  if (descr) data.descr = descr;
  let asn = whoisData.asn
    || whoisData.origin
    || whoisData.originas
    || whoisData['aut-num'];
  if (asn) {
    // use only first ASN from possible list
    asn = asn.split(',')[0].split('\n')[0];
    // only number
    if (asn.startsWith('AS')) {
      asn = asn.slice(2);
    }
    const dotIndex = asn.indexOf('.');
    if (dotIndex === -1) {
      // asplain
      asn = parseInt(asn, 10);
      if (!Number.isNaN(asn)) {
        data.asn = asn;
      }
    } else {
      // asdot
      const p1 = parseInt(asn.slice(0, dotIndex));
      const p2 = parseInt(asn.slice(dotIndex + 1));
      if (!Number.isNaN(p1) && !Number.isNaN(p2)) {
        data.asn = (p1 << 16) | p2;
      }
    }
  }
  const country = whoisData.country
    || whoisData.organisation?.Country
    || whoisData['country-code'];
  if (country) {
    data.country = country.slice(0, 2).toLowerCase();
  }
  return data;
}

/*
 * send a raw whois query to server
 * @param query
 * @param hostInput host with or without port
 */
function singleWhoisQuery(
  query,
  hostInput,
) {
  const options = {
    timeout: WHOIS_TIMEOUT,
  };

  const pos = hostInput.indexOf(':');
  if (~pos) {
    // split port if neccessary
    options.host = hostInput.slice(0, pos);
    options.port = hostInput.slice(pos + 1);
  } else {
    options.host = hostInput;
    options.port = WHOIS_PORT;
  }
  if (OUTGOING_ADDRESS) {
    options.localAddress = OUTGOING_ADDRESS;
    options.family = isIPv6(OUTGOING_ADDRESS) ? 6 : 4;
  }

  return new Promise((resolve, reject) => {
    let data = '';
    const socket = net.createConnection(
      options,
      () => socket.write(query + QUERY_SUFFIX),
    );
    socket.on('data', (chunk) => { data += chunk; });
    socket.on('close', () => resolve(data));
    socket.on('timeout', () => socket.destroy(new Error('Timeout')));
    socket.on('error', reject);
  });
}

/*
 * check if whois result is referring us to
 * a different whois server
 */
const referralKeys = [
  'whois:',
  'refer:',
  'ReferralServer:',
];
function checkForReferral(
  whoisResult,
) {
  for (let u = 0; u < referralKeys.length; u += 1) {
    const key = referralKeys[u];
    const pos = whoisResult.indexOf(key);
    if (~pos) {
      const line = whoisResult.slice(
        whoisResult.lastIndexOf('\n', pos) + 1,
        whoisResult.indexOf('\n', pos),
      ).trim();
      if (!line.startsWith(key)) {
        continue;
      }
      let value = line.slice(line.indexOf(':') + 1).trim();
      const prot = value.indexOf('://');
      if (~prot) {
        value = value.slice(prot + 3);
      }
      return value;
    }
  }
  return null;
}

/**
 * whois ip
 * @param ip ip as string
 * @param host whois host (optional)
 * @returns {
 *   range as [start: hex, end: hex, mask: number],
 *   org as string,
 *   descr as string,
 *   asn as unsigned 32bit integer,
 *   country as two letter lowercase code,
 *   referralHost as string,
 *   referralRange as [start: hex, end: hex, mask: number],
 * }
 */
export default async function whoisIp(ip, options) {
  let host = options?.host || 'whois.iana.org';
  const logger = options?.logger || console;
  let whoisResult;
  let prevResult;
  let prevHost;
  let refCnt = 0;
  while (refCnt < 5) {
    let queryPrefix = '';
    if (host === 'whois.arin.net') {
      queryPrefix = '+ n';
    } else if (host === 'whois.ripe.net') {
      /*
       * flag to not return personal information, otherwise
       * RIPE is gonna rate limit and ban
       */
      queryPrefix = '-r';
    }

    try {
      // eslint-disable-next-line no-await-in-loop
      whoisResult = await singleWhoisQuery(`${queryPrefix} ${ip}`, host);
      const ref = checkForReferral(whoisResult);
      if (!ref) {
        break;
      }
      prevResult = whoisResult;
      prevHost = host;
      host = ref;
    } catch (err) {
      // eslint-disable-next-line no-console
      logger.error(`WHOIS ${ip} ${host}: ${err.message}`);
      host = prevHost;
      break;
    }
    refCnt += 1;
  }

  let result = parseWhois(ip, whoisResult);
  if (!result.range) {
    // eslint-disable-next-line no-console
    logger.error(`WHOIS ${ip} ${host}: This host gives incomplete results.`);
    host = prevHost;
  }
  if (prevResult) {
    const pastWhois = parseWhois(ip, prevResult);
    if (host && pastWhois.range) {
      result.referralHost = host;
      result.referralRange = pastWhois.range;
    }
    result = { ...pastWhois, ...result };
  }
  result.ip = ip;
  return result;
}
