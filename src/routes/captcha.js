/*
 * route providing captcha
 */
import logger from '../core/logger';
import { requestCaptcha } from '../core/captchaserver';
import { getIPFromRequest } from '../utils/ip';
import { setCaptchaSolution, isTrusted } from '../data/redis/captcha';

async function captcha(req, res) {
  res.set({
    'Access-Control-Expose-Headers': 'captcha-id, challenge-needed',
    'Cache-Control': 'no-cache, no-store, must-revalidate',
  });

  const ip = getIPFromRequest(req);

  try {
    const [trusted, [err, text, data, id]] = await Promise.all([
      isTrusted(ip, req.headers['user-agent']),
      new Promise((resolve) => {
        requestCaptcha((...args) => resolve(args));
      }),
    ]);

    if (err) {
      throw new Error(err);
    }
    setCaptchaSolution(text, id);
    logger.info(`CAPTCHA ${ip} got captcha with text: ${text}`);

    res.set({
      'Content-Type': 'image/svg+xml',
      'Captcha-Id': id,
      'Challenge-Needed': trusted ? '0' : '1',
    });
    res.end(data);
  } catch (err) {
    if (!res.writableEnded) {
      res.status(503);
      res.set({ 'Content-Type': 'text/html; charset=utf-8' });
      res.send(
        // eslint-disable-next-line max-len
        '<html><body><h1>Captchaserver: 503 Server Error</h1>Maybe try it later again</body></html>',
      );
    }
    logger.warn(err.message);
  }
}

export default captcha;
