/*
 * request password change
 */

import logger from '../../../core/logger.js';
import { validatePassword } from '../../../utils/validation.js';
import { compareToHash } from '../../../utils/hash.js';
import { setPassword } from '../../../data/sql/User.js';

function validate(password, newPassword, gettext) {
  const errors = [];

  if (password) {
    const passerror = gettext(validatePassword(password));
    if (passerror) errors.push(passerror);
  }
  const newpassworderror = gettext(validatePassword(newPassword));
  if (newpassworderror) errors.push(newpassworderror);

  return errors;
}

export default async (req, res) => {
  const { newPassword, password } = req.body;
  const { t, gettext } = req.ttag;
  const errors = validate(password, newPassword, gettext);
  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const { user } = req;
  /* remember that we do allow users to not have a password set */
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
