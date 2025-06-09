import express from 'express';

import logger from '../../../core/logger';
import { getHostFromRequest } from '../../../utils/ip';
import passport from '../../../core/passport';
import { ensureLoggedIn, openSession } from '../../../middleware/session';

import register from './register';
import verify from './verify';
import logout from './logout';
// eslint-disable-next-line camelcase
import resend_verify from './resend_verify';
// eslint-disable-next-line camelcase
import change_passwd from './change_passwd';
// eslint-disable-next-line camelcase
import delete_account from './delete_account';
// eslint-disable-next-line camelcase
import change_name from './change_name';
// eslint-disable-next-line camelcase
import change_mail from './change_mail';
// eslint-disable-next-line camelcase
import restore_password from './restore_password';

import getHtml from '../../../ssr/RedirectionPage';

import getMe from '../../../core/me';

const router = express.Router();

/*
 * third party logon
 */

router.use(passport.initialize());

const openSessionOnReturn = async (req, res) => {
  await openSession(req, res, req.user);
  res.redirect('/');
};

router.get('/facebook', passport.authenticate('facebook',
  { scope: ['email'] }));
router.get('/facebook/return', passport.authenticate('facebook', {
  session: false,
}), openSessionOnReturn);

router.get('/discord', passport.authenticate('discord',
  { scope: ['identify', 'email'] }));
router.get('/discord/return', passport.authenticate('discord', {
  session: false,
}), openSessionOnReturn);

router.get('/google', passport.authenticate('google',
  { scope: ['email', 'profile'] }));
router.get('/google/return', passport.authenticate('google', {
  session: false,
}), openSessionOnReturn);

router.get('/vk', passport.authenticate('vkontakte',
  { scope: ['email'] }));
router.get('/vk/return', passport.authenticate('vkontakte', {
  session: false,
}), openSessionOnReturn);

router.get('/reddit', passport.authenticate('reddit',
  { duration: 'temporary', state: 'foo' }));
router.get('/reddit/return', passport.authenticate('reddit', {
  session: false,
}), openSessionOnReturn);

// eslint-disable-next-line no-unused-vars
router.use((err, req, res, next) => {
  const host = getHostFromRequest(req);
  logger.info(`Authentication error: ${err.message}`);
  const index = getHtml(
    'OAuth Authentication',
    err.message, host, req.lang,
  );
  res.status(400).send(index);
});

router.get('/verify', verify);

/*
 * JSON APIs
 */

router.post('/restore_password', restore_password);

router.post('/register', register);

router.post('/local', passport.authenticate('json', {
  session: false,
}), async (req, res) => {
  const { user } = req;

  /* session duration, null for permanent */
  let { durationHours } = req.body;
  if (durationHours !== null) {
    durationHours = parseInt(durationHours, 10);
    if (Number.isNaN(durationHours)) {
      // default to 30 days if gibberish
      durationHours = 720;
    }
  }

  await openSession(req, res, user, durationHours);
  logger.info(`User ${user.id} logged in with mail/password.`);
  const me = await getMe(user, req.lang);
  res.json({
    success: true,
    me,
  });
});

router.use(ensureLoggedIn);

/*
 * require registered user after this point
 */

router.get('/logout', logout);

router.get('/resend_verify', resend_verify);

router.post('/change_passwd', change_passwd);

router.post('/change_name', change_name);

router.post('/change_mail', change_mail);

router.post('/delete_account', delete_account);



export default router;
