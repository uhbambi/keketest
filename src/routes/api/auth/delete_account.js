/*
 * request password change
 */

import logger from '../../../core/logger';
import socketEvents from '../../../socket/socketEvents';
import { validatePassword } from '../../../utils/validation';
import { compareToHash } from '../../../utils/hash';
import { deleteUser } from '../../../data/sql/User';
import { clearCookie } from '../../../middleware/session';

function validate(password, gettext) {
  const errors = [];

  const passworderror = gettext(validatePassword(password));
  if (passworderror) errors.push(passworderror);

  return errors;
}

export default async (req, res) => {
  const { password } = req.body;
  const { t, gettext } = req.ttag;
  const errors = await validate(password, gettext);
  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const { user } = req;
  const { id, name } = user;

  const currentPassword = user.data.password;
  if (!currentPassword || !compareToHash(password, currentPassword)) {
    res.status(400);
    res.json({
      errors: [t`Incorrect password!`],
    });
    return;
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Deleted user ${user.name}(${user.id}) by ${req.ip.ipString}`);

  const ret = await deleteUser(user.id);
  if (!ret) {
    res.status(500);
    res.json({
      errors: [t`Server error when deleting user.`],
    });
    return;
  }
  const { dmChannels } = ret;
  if (dmChannels.length > 0) {
    dmChannels.forEach(({ cid, uidA, uidB }) => {
      socketEvents.broadcastRemoveChatChannel(uidA, cid);
      socketEvents.broadcastRemoveChatChannel(uidB, cid);
    });
  }
  clearCookie(req, res);

  socketEvents.reloadUser(user.id);

  res.status(200);
  res.json({
    success: true,
  });
};
