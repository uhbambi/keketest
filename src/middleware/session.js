import { parse as parseCookie, serialize as serializeCookie } from 'cookie';

import { resolveSession, createSession } from '../data/sql/Session';
import { getHostFromRequest } from '../utils/intel/ip';

/*
 * express middleware to parse session cookie and add user,
 * if session can not be verified, continue without setting user
 */
export async function verifySession(req, res, next) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = cookies['ppfun.session'];
  const user = await resolveSession(token);
  if (user) {
    req.user = user;
  }
  next();
}

/*
 * express middleware that cancels if not logged in
 */
export function ensureLoggedIn(req, res, next) {
  if (!req.user) {
    let errorMessage;
    if (req.ttag) {
      const { t } = req.ttag;
      errorMessage = t`You are not logged in`;
    } else {
      errorMessage = 'You are not logged in';
    }
    const error = new Error(errorMessage);
    error.status = 401;
    next(error);
  }
  next();
}

/**
 * Open a new session, set cookie and store it, NOT a middleware
 * @param req express request object
 * @param res express response object
 * @param user user data
 * @return boolean if successful
 */
export async function openSession(req, res, user) {
  const domain = getHostFromRequest(req, false, true);

  const session = await createSession(user.id);
  if (!session) {
    return false;
  }
  const { token, expires } = session;

  res.set({
    'Set-Cookie': serializeCookie('ppfun.session', token, {
      domain,
      httpOnly: true,
      secure: false,
      expires,
    }),
  });
  return true;
}
