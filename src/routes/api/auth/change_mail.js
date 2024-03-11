/*
 * request password change
 */

import mailProvider from '../../../core/MailProvider';

import { validatePassword, validateEMail } from '../../../utils/validation';
import { getHostFromRequest } from '../../../utils/ip';
import { compareToHash } from '../../../utils/hash';
import { checkIfMuted } from '../../../data/redis/chat';
import { checkIfMailDisposable } from '../../../core/isAllowed';
import { USERLVL } from '../../../core/constants';

async function validate(email, password, t, gettext) {
  const errors = [];

  const passerror = gettext(validatePassword(password));
  if (passerror) errors.push(passerror);
  const mailerror = gettext(validateEMail(email));
  if (mailerror) {
    errors.push(mailerror);
  } else if (await checkIfMailDisposable(email)) {
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
  const currentPassword = user.regUser.password;
  if (!compareToHash(password, currentPassword)) {
    res.status(400);
    res.json({
      errors: [t`Incorrect password!`],
    });
    return;
  }

  const mutedTtl = await checkIfMuted(user.id);
  if (mutedTtl !== -2) {
    res.status(403);
    res.json({
      errors: [t`Muted Users can not do this.`],
    });
    return;
  }

  const { regUser } = user;
  let { userlvl } = regUser;
  if (userlvl <= USERLVL.VERIFIED && userlvl > USERLVL.REGISTERED) {
    userlvl = USERLVL.REGISTERED;
  }
  await regUser.update({
    email,
    userlvl,
  });

  const host = getHostFromRequest(req);
  mailProvider.sendVerifyMail(email, regUser.name, host, lang);

  res.json({
    success: true,
  });
};
