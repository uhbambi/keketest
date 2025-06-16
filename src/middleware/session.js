/*
 * express middlewares for handling user sessions
 */
import { parse as parseCookie } from 'cookie';
import { HOUR } from '../core/constants';

import {
  resolveSession, createSession, removeSession,
} from '../data/sql/Session';
import { parseListOfBans } from '../data/sql/Ban';
import { getHostFromRequest } from '../utils/intel/ip';
import { touchUser } from '../data/sql/User';

class User {
  id;
  userlvl;
  /*
   * {
   *   id,
   *   name,
   *   password,
   *   userlvl,
   *   flags,
   *   lastSeen,
   *   createdAt,
   *   mailreg,
   *   bans: [ { expires, flags }, ... ],
   *   tpids: [ { tpid, provider }, ... ],
   *   blocked: [ { id, name }, ...],
   *   channels: {
   *     cid: [ name, type, lastTs, [dmuid] ],
   *     ...
   *   },
   * }
   */
  #data;
  /* session token */
  #token;
  /* null | boolean */
  isBanned = null;
  /* null | boolean */
  isMuted = null;
  /*
   * timestamp when ban should be rechecked,
   * null means to never recheck (so if not banned or perma banned)
   */
  banRecheckTs = null;

  constructor(data, token) {
    this.id = data.id;
    this.userlvl = data.userlvl;
    this.#token = token;
    this.#data = data;
    const [isBanned, isMuted, banRecheckTs] = parseListOfBans(data.bans);
    this.isBanned = isBanned;
    this.isMuted = isMuted;
    this.banRecheckTs = banRecheckTs;
  }

  get data() {
    return this.#data;
  }

  get name() {
    return this.#data.name;
  }

  touch(ipString) {
    if (this.#data.lastSeen.getTime() > Date.now() - 10 * 60 * 1000) {
      return null;
    }
    return touchUser(this.id, ipString);
  }

  hasChannel(cid) {
    return !!this.#data.channels[cid];
  }

  getChannel(cid) {
    return this.#data.channels[cid];
  }

  removeChannel(cid) {
    delete this.#data.channels[cid];
  }

  addChannel(cid, channelArray) {
    this.#data.channels[cid] = channelArray;
  }

  refresh() {
    return this.getAllowance(true);
  }

  /**
   * fetch allowance data of user
   * @param refresh whether we should refetch it, weven if we have it already
   * @return { isBanned, isMuted }
   */
  async getAllowance(refresh = false) {
    if (refresh
      || (this.banRecheckTs !== null && this.banRecheckTs < Date.now())
    ) {
      const data = await resolveSession(this.token);
      if (data) {
        this.userlvl = data.userlvl;
        this.#data = data;
        const [isBanned, isMuted, banRecheckTs] = parseListOfBans(data.bans);
        this.isBanned = isBanned;
        this.isMuted = isMuted;
        this.banRecheckTs = banRecheckTs;
      }
    }
    return { isBanned: this.isBanned, isMuted: this.isMuted };
  }
}

/**
 * resolve session of request by session cookie and add user object if possible
 * @param req express request
 */
async function resolveSessionOfRequest(req) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = cookies['ppfun.session'];
  const userData = await resolveSession(token);
  if (!userData) {
    delete req.user;
  } else {
    req.user = new User(userData);
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
export async function verifySessionPromisified(req) {
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
 * @param userId user id
 * @param durationHours how long session is valid in hours or null for permanent
 * @return boolean if successful
 */
export async function openSession(req, res, userId, durationHours = 720) {
  const domain = getHostFromRequest(req, false, true);

  const token = await createSession(userId, durationHours);
  if (!token) {
    return false;
  }
  const userData = await resolveSession(token);
  if (!userData) {
    delete req.user;
    return false;
  }
  req.user = new User(userData);

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
    cookieOptions.expires = Date.now(durationHours * HOUR);
  }

  res.cookie('ppfun.session', token, cookieOptions);
  return true;
}

export function clearCookie(req, res) {
  const domain = getHostFromRequest(req, false, true);
  res.clearCookie('ppfun.session', {
    domain, httpOnly: true, secure: false,
  });
}

/**
 * Close a session and remove cookie, NOT a middleware
 * @param req express request object
 * @param res express response object
 * @return boolean if successful
 */
export async function closeSession(req, res) {
  const cookies = parseCookie(req.headers.cookie || '');
  const token = cookies['ppfun.session'];
  const success = await removeSession(token);
  clearCookie(req, res);
  delete req.user;
  return success;
}
