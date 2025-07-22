/*
 * Cryptographic hashing
 */

import bcrypt from 'bcrypt';
import { createHash, randomBytes } from 'crypto';

/*
 * bcrypt hash for passwords
 */

export function generateHash(password) {
  return bcrypt.hashSync(password, bcrypt.genSaltSync(8), null);
}

export function compareToHash(password, hash) {
  if (!password || !hash) return false;
  return bcrypt.compareSync(password, hash);
}

/*
 * 216 bit token and SHA-224 hash for sessions
 */

export function generateToken() {
  return randomBytes(27).toString('base64');
}

export function generateTokenHash(token) {
  return createHash('sha224').update(token).digest('base64').substring(0, 38);
}

/*
 * UUIDv4 generation
 */
export function generateUUID() {
  const bytes = randomBytes(16);
  /* v4 */
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  /* variant 10 */
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return bytes;
}
