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
 * compare password to hash, returning translated error string if false
 */
export function comparePasswordToHash(password, hash, t) {
  if (compareToHash(password, hash)) {
    return null;
  }
  let error;
  if (hash === 'hacked') {
    // eslint-disable-next-line max-len
    error = new Error(t`This email / password combination got hacked and leaked. To protect this account, the password has been reset. Please use the "Forgot my password" function on the LogIn page to set a new password. In the future, consider not installing malware, Thank You.`);
  } else {
    error = new Error(t`Incorrect password!`);
  }
  error.status = 401;
  return error;
}

/*
 * 216 bit token and SHA-224 hash for sessions
 */

export function generateToken() {
  return randomBytes(30).toString('base64');
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
