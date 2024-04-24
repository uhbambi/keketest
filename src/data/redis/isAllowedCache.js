/*
 * cache allowed ips
 * used for proxychecker and banlist
 */

import client from './client';

export const PREFIX = 'isal';
export const USER_PREFIX = 'isual';
export const MAIL_PREFIX = 'ised';
const CACHE_DURATION = 14 * 24 * 3600;
const USER_CACHE_DURATION = 12 * 3600;
const MAIL_CACHE_DURATION = 7 * 24 * 3600;

export function cacheIpAllowed(ip, status) {
  try {
    const key = `${PREFIX}:${ip}`;
    const expires = (status !== -2) ? CACHE_DURATION : 3600;
    return client.set(key, status, {
      EX: expires,
    });
  } catch (err) {
    console.error(`Resis Error on cacheIpAllowed ${ip}: ${err.message}`);
    return null;
  }
}

export async function getCacheIpAllowed(ip) {
  try {
    const key = `${PREFIX}:${ip}`;
    let cache = await client.get(key);
    if (!cache) {
      return null;
    }
    return parseInt(cache, 10);
  } catch (err) {
    console.error(`Resis Error on getCacheIpAllowed ${ip}: ${err.message}`);
    return -2;
  }
}

export function cleanCacheForIP(ip) {
  const key = `${PREFIX}:${ip}`;
  return client.del(key);
}

export function cacheUserAllowed(uid, status) {
  try {
    const key = `${USER_PREFIX}:${uid}`;
    return client.set(key, status, {
      EX: USER_CACHE_DURATION,
    });
  } catch (err) {
    console.error(`Resis Error on cacheUserAllowed ${uid}: ${err.message}`);
    return null;
  }
}

/*
 * @return
 *   -2: some failure
 *    0: not banned
 *    1: banned
 */
export async function getCacheUserAllowed(uid) {
  try {
    const key = `${USER_PREFIX}:${uid}`;
    let cache = await client.get(key);
    if (!cache) {
      return null;
    }
    return parseInt(cache, 10);
  } catch (err) {
    console.error(`Resis Error on getCacheUserAllowed ${uid}: ${err.message}`);
    return -2;
  }
}

export function cleanCacheForUser(uid) {
  const key = `${USER_PREFIX}:${uid}`;
  return client.del(key);
}

export function cacheMailProviderDisposable(mailProvider, isDisposable) {
  const key = `${MAIL_PREFIX}:${mailProvider}`;
  const value = (isDisposable) ? '1' : '';
  return client.set(key, value, {
    EX: MAIL_CACHE_DURATION,
  });
}

export async function getCacheMailProviderDisposable(mailProvider) {
  const key = `${MAIL_PREFIX}:${mailProvider}`;
  const cache = await client.get(key);
  if (!cache) {
    return null;
  }
  return cache === '1';
}
