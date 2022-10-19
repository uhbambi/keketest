/*
 * request resend of verification mail
 */

import mailProvider from '../../../core/MailProvider';
import { getHostFromRequest } from '../../../utils/ip';
import { USERLVL } from '../../../data/sql';

export default async (req, res) => {
  const { user, lang } = req;

  const { name, email, userlvl } = user.regUser;
  if (userlvl >= USERLVL.VERIFIED) {
    res.status(400);
    res.json({
      errors: ['You are already verified.'],
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
