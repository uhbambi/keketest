import express from 'express';

import { verifySession, ensureLoggedIn } from '../../middleware/session.js';
import MassRateLimiter from '../../utils/MassRateLimiter.js';
import logger from '../../core/logger.js';
import { HOUR } from '../../core/constants.js';

import me from './me.js';
import auth from './auth/index.js';
import chatHistory from './chathistory.js';
import startDm from './startdm.js';
import leaveChan from './leavechan.js';
import block from './block.js';
import blockdm from './blockdm.js';
import privatize from './privatize.js';
import modtools from './modtools.js';
import baninfo from './baninfo.js';
import getiid from './getiid.js';
import shards from './shards.js';
import profile from './profile.js';
import banme from './banme.js';

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
