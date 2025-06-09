/*
 * express middlewares for handling user sessions
 */
import { parse as parseCookie } from 'cookie';
import { HOUR } from '../cores/constants';

import {
  resolveSession, createSession, removeSession,
} from '../data/sql/Session';
import { getHostFromRequest } from '../utils/intel/ip';

/**
 * resolve session of request by session cookie and add user object if possible
 * @param req express request
 */
async function resolveSessionOfRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = cookies['ppfun.session'];
  const user = await resolveSession(token);
  if (user) {
    req.user = user;
  }
}

/*
 * express middleware to parse session cookie and add user,
 * if session can not be verified, continue without setting user
 */
export async function verifySession(req, res, next) {
  await resolveSessionOfRequest(req);
  next();
}

/*
 * express middleware to verify session in a promise under req.promise,
 * Promise can be resolved by './promises.js' middleware.
 * This has the purpose to allow other actions to happen while we wait for SQL.
 */
export async function verifySessionPromisified(req, res, next) {
  if (!req.promise) {
    req.promise = [];
  }
  req.promise.push(resolveSessionOfRequest(req));
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
 * @param durationHours how long session is valid in hours or null for permanent
 * @return boolean if successful
 */
export async function openSession(req, res, user, durationHours = 720) {
  const domain = getHostFromRequest(req, false, true);

  const session = await createSession(user.id, durationHours);
  if (!session) {
    return false;
  }
  const { token } = session;

  const cookieOptions = { domain, httpOnly: true, secure: false };

  if (durationHours === null) {
    /* a permanent cookie is just a cookie that expires really late */
    durationHours = 24 * 365 * 15;
  }
  /*
   * if durationHours is 0, we don't set expire, which makes it expire on
   * closing the browser
   */
  if (durationHours) {
    cookieOptions['expires'] = Date.now(durationHours * HOUR);
  }

  res.cookie('ppfun.session', token, cookieOptions);
  return true;
}

/**
 * Close a session and remove cookie, NOT a middleware
 * @param req express request object
 * @param res express response object
 * @return boolean if successful
 */
export async function closeSession(req, res, user) {
  const domain = getHostFromRequest(req, false, true);
  const cookies = parseCookie(req.headers.cookie || '');
  const token = cookies['ppfun.session'];
  const success = await removeSession(token);
  res.cookie('ppfun.session', token, { domain, httpOnly: true, secure: false });
  return success;
}
