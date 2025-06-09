/*
 * express middlewares for handling ip information
 */
import { USE_XREALIP } from '../core/config';
import { sanitizeIPString, ipToHex } from '../utils/intel/ip';
import { getIPIntelOverShards } from '../utils/intel';
import { getIPAllowance, touchIP } from '../data/sql/IP';

class IP {
  /* expressjs request object */
  #req;
  /*
   * {
   *   lastSeen,
   *   isWhitelisted,
   *   isBanned,
   *   isProxy,
   *   country: two letter country code,
   *   whoisExpires: Date object for when whois expires,
   *   proxyCheckExpires: Date object for when proxycheck expires,
   * }
   */
  #allowance;
  /* null | boolean */
  isProxy = null;
  /* null | boolean */
  isBanned = null;

  constructor(req) {
    this.#req = req;
  }

  /**
   * @return ip as string, IPv6 cut to 64bit block
   */
  get ipString () {
    const req = this.#req;
    let ipString;
    if (USE_XREALIP) {
      ipString = req.headers['x-real-ip'];
    }
    if (!ipString) {
      ipString = req.connection.remoteAddress;
      if (USE_XREALIP) {
        console.warn(
          `Connection not going through reverse proxy! IP: ${ipString}`,
        );
      }
    }
    ipString = sanitizeIPString(ipString);
    delete this.ipString;
    this.ipString = ipString;
    return ipString;
  }

  /**
   * @return ip as hex string, IPv6 cut to 64bit block
   */
  get ipHex() {
    return ipToHex(this.ipString);
  }

  /**
   * @return ip as Number (IPv4) or BigInt (IPv6)
   */
  get ipNum() {
    const ipHex = `0x${this.ipHex}`;
    return (ipHex.lengh > 10) ? BigInt(ipHex) : Number(ipHex);
  }

  /**
   * @return lower case two letter country code of ip if given by header
   */
  get country() {
    const cc = this.#req.headers['cf-ipcountry'];
    return (cc) ? cc.toLowerCase() : 'xx';
  }

  toString() {
    return this.ipString;
  }

  toHex() {
    return this.ipHex;
  }

  toNum() {
    return this.ipNum;
  }

  /**
   * update lastSeen timestamps of IP
   * @return Promise<>
   */
  touch() {
    if (!this.allowance
      || this.allowance.lastSeen.getTime() > Date.now() - 10 * 60 * 1000
    ) {
      return;
    }
    return touchIP(this.ipString);
  }

  /**
   * fetch allowance data of ip
   * @param refresh whether we should refetch it, even if we have it already
   * @return { isBanned, isProxy }
   */
  async getIPAllowance(refresh = false) {
    const currentTs = Date.now();

    if (!this.#allowance || refresh
      || this.#allowance.whoisExpires.getTime() < currentTs
      || this.#allowance.proxyCheckExpires.getTime() < currentTs
    ) {
      const { ipString } = this;
      const allowance = await getIPAllowance(ipString);
      const needWhois = allowance.whoisExpires.getTime() < currentTs;
      const needProxyCheck = allowance.proxyCheckExpires.getTime() < currentTs;
      if (needWhois || needProxyCheck) {
        try {
          const [
            whoisData, proxyCheckData,
          ] = await getIPIntelOverShards(ipString);

          if (whoisData) {
            allowance.whoisExpires = whoisData.expires;
            allowance.country = whoisData.country || 'xx';
          }

          if (proxyCheckData) {
            allowance.proxyCheckExpires = proxyCheckData.expires;
            allowance.isProxy = proxyCheckData.isProxy;
          }

        } catch (error) {
          console.error(`IP Error on getIPAllowance: ${error.message}`);
        }
      }

      /* prefer whois for country code over headers: overwrite getter */
      if (allowance.country && allowance.country !== 'xx') {
        delete this.country;
        this.country = allowance.country;
      }

      this.isBanned = allowance.isBanned;
      this.isProxy = !allowance.isWhitelisted && allowance.isProxy;
      this.#allowance = allowance;
    }
    return {
      isBanned: this.isBanned,
      isProxy: this.isProxy,
    }
  }
}

/*
 * express middleware to add IP object to request
 */
export function parseIP(req, res, next) {
  req.ip = new IP(req);
  next();
}

/*
 * express middleware to resolve IP allowance in a promise under req.promise,
 * must be called after parseIP.
 * Promise can be resolved by './promises.js' middleware.
 * This has the purpose to allow other actions to happen while we wait.
 */
export async function ipAllowancePromisified(req, res, next) {
  if (!req.promise) {
    req.promise = [];
  }
  req.promise.push(req.ip.getIPAllowance());
  next();
}
