import express from 'express';

import { verifySession, ensureLoggedIn } from '../../middleware/session';
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
 * get user session if available
 */
router.use(verifySession);

router.get('/chathistory', chatHistory);

router.get('/me', me);

router.get('/baninfo', baninfo);

router.use('/auth', auth);

router.use('/modtools', modtools);

router.post('/banme', banme);

/*
 * only with session
 */
router.use(ensureLoggedIn);

/*
 * rate limit per user
 */
router.use((req, res, next) => {
  if (rateLimiter.tick(req.user.id, 3000, null, onRateLimitTrigger)) {
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

/*
 * error handling
 */
// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.status(err.status || 400).json({
    errors: [err.message],
  });
});

export default router;
