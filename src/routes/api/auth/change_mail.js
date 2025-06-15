/*
 * request mail change
 */

import mailProvider from '../../../core/MailProvider';

import logger from '../../../core/logger';
import { getHostFromRequest } from '../../../utils/intel/ip';
import { validatePassword, validateEMail } from '../../../utils/validation';
import { compareToHash } from '../../../utils/hash';
import { checkMailOverShards } from '../../../utils/intel';
import { setEmail } from '../../../data/sql/ThreePID';
import { setUserLvl } from '../../../data/sql/User';
import { USERLVL } from '../../../core/constants';

async function validate(email, password, t, gettext) {
  const errors = [];

  const passerror = gettext(validatePassword(password));
  if (passerror) errors.push(passerror);
  const mailerror = gettext(validateEMail(email));
  if (mailerror) {
    errors.push(mailerror);
  } else if (await checkMailOverShards(email)) {
    errors.push(t`This email provider is not allowed`);
  }

  return errors;
}

export default async (req, res) => {
  const { email, password } = req.body;
  const { t, gettext } = req.ttag;
  const errors = await validate(email, password, t, gettext);
  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const { user, lang } = req;
  const currentPassword = user.data.password;
  if (!compareToHash(password, currentPassword)) {
    res.status(400);
    res.json({
      errors: [t`Incorrect password!`],
    });
    return;
  }

  const ret = await setEmail(user.id, email, false);
  if (!ret) {
    res.status(400);
    res.json({
      errors: [t`Could not set email, maybe it is already in use!`],
    });
    return;
  }

  let { userlvl } = user;
  if (userlvl <= USERLVL.VERIFIED && userlvl > USERLVL.REGISTERED) {
    await setUserLvl(user.id, USERLVL.REGISTERED);
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Changed mail for user ${user.name}(${user.id}) to ${email} by ${req.ip.ipString}`);

  const host = getHostFromRequest(req);
  mailProvider.sendVerifyMail(email, user.name, host, lang);

  res.json({
    success: true,
  });
};
