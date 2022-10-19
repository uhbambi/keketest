/*
 * cache allowed ips
 * used for proxychecker and banlist
 */

import client from './client';

export const PREFIX = 'isal';
export const MAIL_PREFIX = 'ised';
const CACHE_DURATION = 14 * 24 * 3600;
const MAIL_CACHE_DURATION = 7 * 24 * 3600;

export function cacheAllowed(ip, status) {
  const key = `${PREFIX}:${ip}`;
  const expires = (status !== -2) ? CACHE_DURATION : 3600;
  return client.set(key, status, {
    EX: expires,
  });
}

export async function getCacheAllowed(ip) {
  const key = `${PREFIX}:${ip}`;
  let cache = await client.get(key);
  if (!cache) {
    return null;
  }
  cache = parseInt(cache, 10);
  return {
    allowed: (cache <= 0),
    status: cache,
  };
}

export function cleanCacheForIP(ip) {
  const key = `${PREFIX}:${ip}`;
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
