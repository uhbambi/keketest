import express from 'express';

import session from '../../core/session';
import passport from '../../core/passport';
import logger from '../../core/logger';
import User from '../../data/User';
import { getIPFromRequest } from '../../utils/ip';
import MassRateLimiter from '../../utils/MassRateLimiter';
import { HOUR } from '../../core/constants';

import me from './me';
import auth from './auth';
import chatHistory from './chathistory';
import startDm from './startdm';
import leaveChan from './leavechan';
import block from './block';
import blockdm from './blockdm';
import privatize from './privatize';
import modtools from './modtools';
import baninfo from './baninfo';
import getiid from './getiid';
import shards from './shards';
import profile from './profile';
import banme from './banme';

const rateLimiter = new MassRateLimiter(HOUR);

const router = express.Router();

function onRateLimitTrigger(userId) {
  logger.warn(`User ${userId} triggered API RateLimit.`);
}

// set cache-control
router.use((req, res, next) => {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Expires: '0',
  });
  next();
});

router.use(express.json());

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  logger.warn(`Got invalid json from ${req.trueIp} on ${req.originalUrl}`);
  res.status(400).json({
    errors: [{ msg: 'Invalid Request' }],
  });
});

// routes that don't need a user
router.get('/baninfo', baninfo);
router.get('/getiid', getiid);
router.get('/shards', shards);

/*
 * get user session
 */
router.use(session);

/*
 * at this point we could use the session id to get
 * stuff without having to verify the whole user,
 * which would avoid SQL requests and it got used previously
 * when we set pixels via api/pixel (new removed)
*/

/*
 * passport authenticate
 * and deserialize
 * (makes that sql request to map req.user.regUser)
 * After this point it is assumes that user.regUser is set if user.id is too
 */
router.use(passport.initialize());
router.use(passport.session());

/*
 * modtools
 * (does not json bodies, but urlencoded)
 */
router.use('/modtools', modtools);

/*
 * create dummy user with just ip if not
 * logged in
 */
router.use(async (req, res, next) => {
  if (!req.user) {
    req.user = new User();
    await req.user.initialize(null, getIPFromRequest(req));
  }
  next();
});

router.get('/chathistory', chatHistory);

router.get('/me', me);

router.use((req, res, next) => {
  const userId = req.user.id;
  if (userId && rateLimiter.tick(userId, 3000, null, onRateLimitTrigger)) {
    throw new Error(
      // eslint-disable-next-line
      'You are doing too many things too fast. Cool down a bit and come back later.',
    );
  }
  next();
});

router.get('/profile', profile);

router.post('/startdm', startDm);

router.post('/leavechan', leaveChan);

router.post('/block', block);

router.post('/blockdm', blockdm);

router.post('/privatize', privatize);

router.post('/banme', banme);

router.use('/auth', auth);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  res.status(400).json({
    errors: [err.message],
  });
});

export default router;
