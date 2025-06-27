/*
 * express middleware to set CORS Headers
 */
import { CORS_HOSTS } from '../core/config.js';

export default (req, res, next) => {
  if (!CORS_HOSTS || !req.headers.origin) {
    next();
    return;
  }
  const { origin } = req.headers;
  if (!origin || origin === 'null') {
    next();
    return;
  }

  const host = origin.slice(origin.indexOf('//') + 2);
  /*
   * form .domain.tld will accept both domain.tld and x.domain.tld
   */
  const isAllowed = CORS_HOSTS.some((c) => c === host
    || (c.startsWith('.') && (host.endsWith(c) || host === c.slice(1))));

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
