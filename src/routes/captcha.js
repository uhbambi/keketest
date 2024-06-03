/*
 * route providing captcha
 */
import logger from '../core/logger';
import requestCaptcha from '../core/captchaserver';
import { getIPFromRequest, getIPv6Subnet } from '../utils/ip';
import { setCaptchaSolution } from '../data/redis/captcha';
import { banIP } from '../data/sql/Ban';

export default (req, res) => {
  res.set({
    'Access-Control-Expose-Headers': 'captcha-id',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });

  requestCaptcha((err, text, data, id) => {
    if (res.writableEnded) {
      throw new Error('ENOR');
    }

    if (err) {
      res.status(503);
      res.send(
        // eslint-disable-next-line max-len
        '<html><body><h1>Captchaserver: 503 Server Error</h1>Captchas are accessible via *.svp paths</body></html>',
      );
      return;
    }

    const ip = getIPFromRequest(req);
    if (req.headers['user-agent']?.split('Mozilla/5.0').length > 2) {
      logger.info(`AUTOBAN soyjak botnet ${ip}`);
      banIP(
        getIPv6Subnet(ip),
        'Proxy ',
        Date.now() + 1000 * 3600 * 24 * 3,
        34273,
      );
    } else {
      setCaptchaSolution(text, id, ip);
    }
    logger.info(`Captchas: ${ip} got captcha with text: ${text}`);

    res.set({
      'Content-Type': 'image/svg+xml',
      'Captcha-Id': id,
    });
    res.end(data);
  });
};
