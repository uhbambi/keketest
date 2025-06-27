/*
 * express middleware to set CORS Headers
 */
import { CORS_HOSTS } from '../core/config.js';

export default (req, res, next) => {
  if (!CORS_HOSTS) {
    next();
    return;
  }

  /* different origin produces different response */
  res.set({
    Vary: 'Origin',
  });

  const { origin } = req.headers;
  if (!origin || origin === 'null') {
    next();
    return;
  }

  const originHost = `.${origin.slice(origin.indexOf('//') + 2)}`;

  if (originHost === req.ip.getHost(false, true)) {
    /* no CORS headers needed */
    next();
    return;
  }

  /*
   * form .domain.tld will accept both domain.tld and x.domain.tld,
   * all CORS_HOSTS entries shall start with a dot or be an IP
   */
  const isAllowed = CORS_HOSTS.some((c) => originHost.endsWith(c));

  if (!isAllowed) {
    next();
    return;
  }

  /*
   * The recommended way of dealing with multiple origin is to return whatever
   * origin requested, according to MDN.
   */
  res.set({
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Credentials': 'true',
  });

  if (req.method === 'OPTIONS') {
    res.set({
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST',
      'Access-Control-Max-Age': '86400',
    });
    res.sendStatus(200);
    return;
  }
  next();
};
