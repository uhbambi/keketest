/*
 * express middleware to add IP related getters to Request object
 * req.ip -> ip as string, IPv6 cut to 64bit block
 * req.ipHex -> ip as hex string
 * req.ipNum -> ip as BigInt if IPv6 and Number if IPv4
 * req.cc -> two character country code based on cloudflare header
 */
import { USE_XREALIP } from '../core/config';
import { isIPv6, unpackIPv6, ipToHex } from './ip';

const ipGetter = {
  get() {
    let ip;
    if (USE_XREALIP) {
      ip = this.headers['x-real-ip'];
    }
    if (!ip) {
      ip = this.connection.remoteAddress;
      if (USE_XREALIP) {
        // eslint-disable-next-line no-console
        console.warn(
          `Connection not going through reverse proxy! IP: ${ip}`,
        );
      }
    }
    if (isIPv6(ip)) {
      ip = `${unpackIPv6(ip).slice(0, 4).join(':')}::`;
    }
    this.ip = ip;
    return ip;
  },
};

const ipHexGetter = {
  get() {
    return ipToHex(this.ip);
  },
};

const ipNumGetter = {
  get() {
    const ipHex = `0x${this.ipHex}`;
    return (ipHex.lengh > 10) ? BigInt(ipHex) : Number(ipHex);
  },
};

const ccGetter = {
  get() {
    if (!USE_XREALIP) {
      return 'xx';
    }
    const cc = this.headers['cf-ipcountry'];
    return (cc) ? cc.toLowerCase() : 'xx';
  },
};

export default (req, res, next) => {
  Object.defineProperty(req, 'ip', ipGetter);
  Object.defineProperty(req, 'ipHex', ipHexGetter);
  Object.defineProperty(req, 'ipNum', ipNumGetter);
  Object.defineProperty(req, 'cc', ccGetter);
  next();
};
