/*
 * third party logins with passport
 */
import express from 'express';
import { parse as parseCookie } from 'cookie';

import passport from '../core/passport.js';
import { sign, unsign, generateTinyToken } from '../utils/hash.js';
import { openSession } from '../middleware/session.js';
import { parseDevice } from '../middleware/device.js';
import errorPage from '../middleware/errorPage.js';
import socketEvents from '../socket/socketEvents.js';

const router = express.Router();

router.use(passport.initialize());

/*
 * abbreviation to strategy
 */
const providerToStrat = {
  vk: 'vkontakte',
  g: 'google',
  d: 'discord',
  fb: 'facebook',
};

/*
 * get into auth flow
 */
router.get('/:provider', (req, res, next) => {
  req.tickRateLimiter(5000);

  const { provider } = req.params;
  const scopes = {
    vk: ['email'],
    g: ['email', 'profile'],
    d: ['identify', 'email'],
    fb: ['email'],
  };
  const scope = scopes[provider];
  if (!scope) {
    throw new Error('No such oauth provider configured');
  }

  const origin = req.query.o || '/';
  const state = generateTinyToken();
  res.cookie('oauth.origin', sign(`${state}:${origin}`), {
    httpOnly: true,
    secure: false,
    expires: new Date(Date.now() + 900 * 1000),
    path: '/tp/r',
    sameSite: 'lax',
  });

  const opts = { scope, state };

  passport.authenticate(
    providerToStrat[provider], opts,
  )(req, res, next);
});

/*
 * return from oauth
 */
router.get('/r/:provider', parseDevice, (req, res, next) => {
  req.tickRateLimiter(7000);

  const { provider } = req.params;

  let state;
  let origin;
  const cookies = parseCookie(req.headers.cookie || '');
  const oauthCookie = unsign(cookies['oauth.origin']);
  if (oauthCookie) {
    const seperator = oauthCookie.indexOf(':');
    if (seperator !== -1) {
      state = oauthCookie.substring(0, seperator);
      origin = oauthCookie.substring(seperator + 1);
    }
  }
  if (req.query.state && state !== req.query.state) {
    throw new Error('Invalid oauth state.');
  }
  req.oauthOrigin = origin;

  const opts = { session: false };

  passport.authenticate(providerToStrat[provider], opts)(req, res, next);
}, async (req, res) => {
  /*
   * this is NOT a full user instance, only { id, name, password, userlvl },
   * it is set by the strategy callback in core/passport.js
   */
  const { user } = req;
  /*
   * openSession() turns req.user into a full user object
   */
  await openSession(req, res, user.id, 168);
  socketEvents.reloadIP(req.ip.ipString);
  if (req.oauthOrigin) {
    let origin = req.oauthOrigin;
    /*
    * on logins for openid connect reauthentification, we should split the
    * promt='login' from the query, to indicate that we authenticated, and add
    * max_age, to make sure that it is recent
    */
    if (origin.startsWith('/oidc/')) {
      const url = new URL(origin, 'http://example.com');
      if (url.searchParams.get('prompt') === 'login') {
        url.searchParams.delete('prompt');
        url.searchParams.set('max_age', '600');
        origin = url.pathname + url.search;
      }
    }
    res.redirect(req.oauthOrigin);
    return;
  }

  res.redirect('/');
});

router.use(errorPage);

export default router;
