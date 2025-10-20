/**
 * basic admin api
 *
 */

import express from 'express';

import logger from '../core/logger.js';
import urlEncoded from '../middleware/formData.js';
import errorPage from '../middleware/errorPage.js';
import getPasswordResetHtml from '../ssr/PasswordReset.jsx';
import getErrorPageHtml from '../ssr/errorPageHTML.js';
import { validateEMail } from '../utils/validation.js';
import { checkCode } from '../data/redis/mailCodes.js';
import { getUserByEmail, setPassword } from '../data/sql/User.js';


const router = express.Router();


/*
 * Check for POST parameters,
 * if invalid password is given, ignore it and go to next
 */
router.post('/', urlEncoded, async (req, res) => {
  req.tickRateLimiter(10000);

  const {
    pass, passconf, code, name: email,
  } = req.body;
  const { lang, ttag } = req;
  const { t } = ttag;
  const title = t`Reset your password here`;

  if (req.csrfPossible) {
    const error = new Error(
      t`You need to directly access this page in the browser :(`,
    );
    error.title = title;
    error.status = 400;
    throw error;
  }

  if (!pass || !passconf || !code) {
    const error = new Error(
      t`You sent an empty password or invalid data :(`,
    );
    error.title = title;
    error.status = 400;
    throw error;
  }

  const ret = await checkCode(email, code);
  if (!ret) {
    const error = new Error(
      t`This password-reset link isn't valid anymore :(`,
    );
    error.title = title;
    error.status = 401;
    throw error;
  }

  if (pass !== passconf) {
    const error = new Error(
      t`Your passwords do not match :(`,
    );
    error.title = title;
    error.status = 400;
    throw error;
  }

  // set password
  const userdata = await getUserByEmail(email);
  if (!userdata) {
    const error = new Error(
      t`User doesn't exist in our database :(`,
    );
    error.title = title;
    error.status = 400;
    throw error;
  }
  await setPassword(userdata.id, pass);

  logger.info(`Changed password of ${email} via password reset form`);
  const html = getErrorPageHtml(
    title,
    t`Password successfully changed.`,
    lang,
    ttag,
  );
  res.status(200).send(html);
}, errorPage);


/*
 * Check GET parameters for action to execute
 */
router.get('/', async (req, res) => {
  const { email, token } = req.query;
  const { lang } = req;
  const { t } = req.ttag;
  const title = t`Reset your password here`;

  if (!token) {
    const error = new Error(
      t`Invalid url :( Please check your mail again.`,
    );
    error.title = title;
    error.status = 400;
    throw error;
  }

  const errorDesc = validateEMail(email);
  if (errorDesc) {
    const error = new Error(errorDesc);
    error.title = title;
    error.status = 401;
    throw error;
  }

  const html = getPasswordResetHtml(email, token, lang);
  res.status(200).send(html);
}, errorPage);

export default router;
