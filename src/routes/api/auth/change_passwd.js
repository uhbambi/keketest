/*
 * request password change
 */

import logger from '../../../core/logger';
import { getIPFromRequest } from '../../../utils/ip';
import { validatePassword } from '../../../utils/validation';
import { compareToHash } from '../../../utils/hash';
import { setPassword } from '../../../data/sql/User';

function validate(newPassword, gettext) {
  const errors = [];

  const newpassworderror = gettext(validatePassword(newPassword));
  if (newpassworderror) errors.push(newpassworderror);

  return errors;
}

export default async (req, res) => {
  const { newPassword, password } = req.body;
  const { t, gettext } = req.ttag;
  const errors = validate(newPassword, gettext);
  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const { user } = req;
  const currentPassword = user.data.password;
  if (currentPassword && !compareToHash(password, currentPassword)) {
    res.status(400);
    res.json({
      errors: [t`Incorrect password!`],
    });
    return;
  }

  await setPassword({ password: newPassword });

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Changed password for user ${user.name}(${user.id}) by ${req.ip.ipString}`);

  res.json({
    success: true,
  });
};
