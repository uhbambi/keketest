/*
 * request password reset mail
 */

import logger from '../../../core/logger';
import mailProvider from '../../../core/MailProvider';
import { validateEMail } from '../../../utils/validation';
import { getHostFromRequest } from '../../../utils/intel/ip';

async function validate(email, gettext) {
  const errors = [];
  const emailerror = gettext(validateEMail(email));
  if (emailerror) errors.push(emailerror);

  return errors;
}

export default async (req, res) => {
  const { ip } = req.user;
  const { email } = req.body;
  const { gettext } = req.ttag;

  const errors = validate(email, gettext);
  if (errors.length > 0) {
    res.status(400);
    res.json({
      errors,
    });
    return;
  }

  const host = getHostFromRequest(req);
  const { lang } = req;
  const error = await mailProvider.sendPasswdResetMail(email, ip, host, lang);
  if (error) {
    // eslint-disable-next-line max-len
    logger.info(`AUTH: Could not send password reset mail for email ${email} by ${req.ip.ipString}`);

    res.status(400);
    res.json({
      errors: [error],
    });
    return;
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Sent password reset mail for email ${email} by ${req.ip.ipString}`);

  res.status(200);
  res.json({
    success: true,
  });
};
