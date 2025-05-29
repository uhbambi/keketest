import express from 'express';

import { verifySession } from '../../middleware/session';
import User from '../../data/User';
import MassRateLimiter from '../../utils/MassRateLimiter';
import logger from '../../core/logger';
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

// routes that don't need a user
router.get('/shards', shards);
router.get('/getiid', getiid);

/*
 * get user session
 */
router.use(verifySession);

/*
 * modtools
 * (does not take urlencoded bodies)
 */
router.use('/modtools', modtools);

/*
 * create unregistered user by request if
 * not logged in
 */
router.use(async (req, res, next) => {
  if (!req.user) {
    req.user = new User(req);
  }
  next();
});

router.get('/chathistory', chatHistory);

router.get('/me', me);

router.get('/baninfo', baninfo);

router.use('/auth', auth);

/*
 * TODO: test if this works,
 */
router.use((req, res, next) => {
  if (!req.user.isRegistered) {
    const { t } = req.ttag;
    const error = new Error(t`You are not logged in`);
    error.status = 401;
    throw error;
  } else if (rateLimiter.tick(req.user.id, 3000, null, onRateLimitTrigger)) {
    const { t } = req.ttag;
    const error = new Error(
      // eslint-disable-next-line
      t`You are doing too many things too fast. Cool down a bit and come back later.`,
    );
    error.status = 429;
    throw error;
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

/*
 * error handling
 */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (res.headersSent) {
    return next(err);
  }
  res.status(err.status || 400).json({
    errors: [err.message],
  });
});

export default router;
