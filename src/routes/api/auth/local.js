/*
 * local login with mail / name and password
 */
import logger from '../../../core/logger.js';
import { getUsersByNameOrEmail } from '../../../data/sql/User.js';
import { touchSession } from '../../../data/sql/Session.js';
import { compareToHash } from '../../../utils/hash.js';
import socketEvents from '../../../socket/socketEvents.js';

import getMe from '../../../core/me.js';
import { openSession } from '../../../middleware/session.js';

export default async (req, res) => {
  const { ttag: { t }, body: { nameoremail, password }, ip } = req;

  const users = await getUsersByNameOrEmail(nameoremail, null);

  try {
    if (!users || !users.length) {
      throw new Error(t`Name or Email does not exist!`);
    }
    const user = users.find((u) => compareToHash(password, u.password));
    if (!user) {
      if (users.find((u) => u.password === 'hacked')) {
        throw new Error(
          // eslint-disable-next-line max-len
          t`This email / password combination got hacked and leaked. To protect this account, the password has been reset. Please use the "Forgot my password" function below to set a new password. In the future, consider not installing malware, Thank You.`,
        );
      }
      // eslint-disable-next-line max-len
      logger.info(`AUTH: Incorrect login attempt for ${nameoremail} by ${ip.ipString}`);
      throw new Error('Incorrect password!');
    }

    /* session duration, null for permanent */
    let { durationsel: durationHours } = req.body;
    if (durationHours === 'forever') {
      durationHours = null;
    } else {
      durationHours = parseInt(durationHours, 10);
      if (Number.isNaN(durationHours)) {
        // default to 30 days if gibberish
        durationHours = 720;
      }
    }

    if (req.user && req.user.id === user.id) {
      /*
       * if we are already logged in, we update the sessions creation time,
       * this is used for reauthentification, which could be requested for old
       * sessions
       */
      await touchSession(req.user.token);
    } else {
      /*
       * new login
       * openSession turns req.user into a full user object
       */
      await openSession(req, res, user.id, durationHours);
      socketEvents.reloadIP(ip.ipString, true);
      logger.info(
        `AUTH: Logged in user ${user.name}(${user.id}) by ${ip.ipString}`,
      );
    }

    const me = await getMe(req.user, ip, req.lang);
    res.json({
      success: true,
      me,
    });
  } catch (error) {
    res.status(401).json({
      errors: [error.message],
    });
  }
};
