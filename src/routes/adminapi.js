import express from 'express';

import logger from '../core/logger';
import { THREEPID_PROVIDERS, USERLVL } from '../data/sql';
import { getUsersByNameOrEmail, findUserById } from '../data/sql/RegUser';
import { getIPFromRequest } from '../utils/ip';
import { compareToHash } from '../utils/hash';
import { APISOCKET_KEY } from '../core/config';

const router = express.Router();

/*
 * Need APISOCKETKEY to access
 */
router.use(async (req, res, next) => {
  const { headers } = req;
  if (!headers.authorization
    || !APISOCKET_KEY
    || headers.authorization !== `Bearer ${APISOCKET_KEY}`) {
    const ip = getIPFromRequest(req);
    logger.warn(`API adminapi request from ${ip} rejected`);
    res.status(401);
    res.json({
      success: false,
      errors: ['No or invalid authorization header'],
    });
    return;
  }
  next();
});

router.use(express.json());

/*
 * check login credentials
 * useful for 3rd party login
 */
router.post('/checklogin', async (req, res) => {
  const errors = [];

  const { password } = req.body;
  if (!password) {
    errors.push('No password given');
  }

  const query = {
    attributes: [
      'id',
      'name',
      'email',
      'password',
      'userlvl',
    ],
  };
  let regusers;
  if (req.body.name || req.body.email) {
    regusers = await getUsersByNameOrEmail(req.body.name, req.body.email, true);
  } else if (req.body.id) {
    regusers = await findUserById(req.body.id);
  } else {
    errors.push('No name or email or idgiven');
  }

  if (errors.length) {
    res.status(400);
    res.json({
      success: false,
      errors,
    });
    return;
  }

  if (!regusers) {
    res.json({
      success: false,
      // eslint-disable-next-line max-len
      errors: [`User ${req.body.name}, ${req.body.email}, ${req.body.id} does not exist`],
    });
    return;
  }

  if (!Array.isArray(regusers)) regusers = [regusers];
  const reguser = regusers.find((u) => compareToHash(password, u.password));
  if (!reguser) {
    logger.info(
      `ADMINAPI: User ${reguser.name} / ${reguser.id} entered wrong password`,
    );
    res.json({
      success: false,
      errors: [`Password wrong for user ${reguser.name} / ${reguser.id}`],
    });
    return;
  }

  let email = reguser.tpids.find(
    (t) => t.provider === THREEPID_PROVIDERS.EMAIL,
  )?.tpid || null;

  logger.info(`ADMINAPI: User ${reguser.name} / ${reguser.id} got logged in`);
  res.json({
    success: true,
    userdata: {
      id: reguser.id,
      name: reguser.name,
      email,
      verified: reguser.userlvl >= USERLVL.VERIFIED,
    },
  });
});

/*
 * get user data
 */
router.post('/userdata', async (req, res) => {
  const { id } = req.body;
  if (!id) {
    res.status(400);
    res.json({
      success: false,
      errors: ['No id given'],
    });
    return;
  }
  const reguser = await findUserById(id);
  if (!reguser) {
    res.json({
      success: false,
      errors: ['No such user'],
    });
    return;
  }

  let email = reguser.tpids.find(
    (t) => t.provider === THREEPID_PROVIDERS.EMAIL,
  )?.tpid || null;

  res.json({
    success: true,
    userdata: {
      id: reguser.id,
      name: reguser.name,
      email,
    },
  });
});

export default router;
