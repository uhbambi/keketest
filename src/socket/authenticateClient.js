/*
 * used to authenticate websocket session
 */

import express from 'express';

import { verifySessionPromisified } from '../middleware/session';
import { ipAllowancePromisified } from '../middleware/ip';
import promises from '../middleware/promises';
import { expressTTag } from '../middleware/ttag';

const router = express.Router();

router.use(verifySessionPromisified);
router.use(ipAllowancePromisified);

router.use(expressTTag);

router.use(promises);

function authenticateClient(req) {
  return new Promise(
    ((resolve) => {
      router(req, {}, resolve);
    }),
  );
}

export default authenticateClient;
