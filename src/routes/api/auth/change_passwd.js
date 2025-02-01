/*
 * request password change
 */

import logger from '../../../core/logger';
import { getIPFromRequest } from '../../../utils/ip';
import { validatePassword } from '../../../utils/validation';
import { compareToHash } from '../../../utils/hash';

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
  const currentPassword = user.regUser.password;
  if (currentPassword && !compareToHash(password, currentPassword)) {
    res.status(400);
    res.json({
      errors: [t`Incorrect password!`],
    });
    return;
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Changed password for user ${user.regUser.name}(${user.id}) by ${getIPFromRequest(req)}`);

  await user.regUser.update({ password: newPassword });

  res.json({
    success: true,
  });
};
