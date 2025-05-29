/*
 * used to authenticate websocket session
 */

import express from 'express';

import { verifySession } from '../middleware/session';
import { expressTTag } from '../middleware/ttag';

const router = express.Router();

router.use(verifySession);

router.use(expressTTag);

function authenticateClient(req) {
  return new Promise(
    ((resolve) => {
      router(req, {}, async () => {
        let user;
        if (req.user) {
          user = req.user;
        }
        user.ttag = req.ttag;
        user.lang = req.lang;
        resolve(user);
      });
    }),
  );
}

export default authenticateClient;
