/*
 * request resend of verification mail
 */

import mailProvider from '../../../core/MailProvider';
import { getHostFromRequest } from '../../../utils/intel/ip';
import { USERLVL } from '../../../data/sql';
import { getEmailOfUser } from '../../../data/sql/ThreePID';

export default async (req, res) => {
  const { user, lang, ttag: { t } } = req;

  const { name, userlvl } = user.data;
  if (userlvl >= USERLVL.VERIFIED) {
    res.status(400);
    res.json({
      errors: [t`You are already verified.`],
    });
    return;
  }

  const email = getEmailOfUser(user.id);
  if (!email) {
    res.status(400);
    res.json({
      errors: [t`Please try again`],
    });
    return;
  }

  const host = getHostFromRequest(req);
  const error = await mailProvider.sendVerifyMail(email, name, host, lang);
  if (error) {
    res.status(400);
    res.json({
      errors: [error],
    });
    return;
  }
  res.json({
    success: true,
  });
};
