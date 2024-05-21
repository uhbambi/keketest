/**
 *
 * check for captcha requirement
 */

import logger from '../../core/logger';
import client from './client';
import { getIPv6Subnet } from '../../utils/ip';
import {
  CAPTCHA_TIME,
  CAPTCHA_TIMEOUT,
  TRUSTED_TIME,
} from '../../core/config';

const TTL_CACHE = CAPTCHA_TIME * 60; // minutes to seconds
const TTL_TRUSTED = TRUSTED_TIME * 60 * 60; // hours to seconds

export const PREFIX = 'human';
export const SOLUTION_PREFIX = 'capt';
export const TRUSTED_PREFIX = 'trus';

/*
 * chars that are so similar that we allow them to get mixed up
 * left: captcha text
 * right: user input
 */
const graceChars = [
  ['I', 'l'],
  ['l', 'I'],
  ['l', 'i'],
  ['i', 'j'],
  ['j', 'i'],
  ['0', 'O'],
  ['0', 'o'],
  ['O', '0'],
];

/*
 * Compare chars of captcha to result
 * @return true if chars are the same
 */
function evaluateChar(charC, charU) {
  if (charC.toLowerCase() === charU.toLowerCase()) {
    return true;
  }
  for (let i = 0; i < graceChars.length; i += 1) {
    const [cc, cu] = graceChars[i];
    if (charC === cc && charU === cu) {
      return true;
    }
  }
  return false;
}

/*
 * Compare captcha to result
 * @return true if same
 */
function evaluateResult(captchaText, userText) {
  if (captchaText.length !== userText.length) {
    return false;
  }
  for (let i = 0; i < captchaText.length; i += 1) {
    if (!evaluateChar(captchaText[i], userText[i])) {
      return false;
    }
  }
  return true;
}

/*
 * mark ip as trusted
 * @param ip
 */
export async function markTrusted(ip) {
  try {
    const key = `${TRUSTED_PREFIX}:${getIPv6Subnet(ip)}`;
    await client.set(key, '', {
      EX: TTL_TRUSTED,
    });
  } catch (err) {
    logger.error(`Error setting IP Trusted: ${err.message}`);
  }
}

/*
 * check if ip is trusted
 * @param ip
 * @return boolean
 */
export async function isTrusted(ip) {
  const key = `${TRUSTED_PREFIX}:${getIPv6Subnet(ip)}`;
  const ttl = await client.ttl(key);
  return ttl > 0;
}

/*
 * set captcha solution
 *
 * @param text Solution of captcha
 * @param captchaid
 */
export async function setCaptchaSolution(
  text,
  captchaid,
  ip,
) {
  try {
    if (!await isTrusted(ip)) {
      text = 'untrusted';
    }
    await client.set(`${SOLUTION_PREFIX}:${captchaid}`, text, {
      EX: CAPTCHA_TIMEOUT,
    });
  } catch (err) {
    logger.error(`Error setting Captcha Solution: ${err.message}`);
  }
}

/*
 * check captcha solution
 *
 * @param text Solution of captcha
 * @param ip
 * @param onetime If the captcha is just one time or should be remembered
 * @param wrongCallback function that gets called when captcha got solved wrong
 *   for this ip
 * @return 0 if solution right
 *         1 if timed out
 *         2 if wrong
 */
export async function checkCaptchaSolution(
  text,
  ip,
  onetime,
  captchaid,
  wrongCallback = null,
) {
  if (!text || text.length > 10) {
    return 3;
  }
  if (!captchaid) {
    return 4;
  }
  const solution = await client.getDel(`${SOLUTION_PREFIX}:${captchaid}`);
  if (solution === 'untrusted') {
    logger.info(`CAPTCHA solution for ${ip} rejected, ip is not trusted`);
    return 5;
  }
  if (solution) {
    if (evaluateResult(solution, text)) {
      if (Math.random() < 0.1) {
        return 2;
      }
      if (!onetime) {
        const ipn = getIPv6Subnet(ip);
        const solvkey = `${PREFIX}:${ipn}`;
        await client.set(solvkey, '', {
          EX: TTL_CACHE,
        });
      }
      logger.info(`CAPTCHA ${ip} successfully solved captcha ${text}`);
      return 0;
    }
    logger.info(
      `CAPTCHA ${ip} got captcha wrong (${text} instead of ${solution})`,
    );
    if (wrongCallback) {
      wrongCallback(text, solution);
    }
    return 2;
  }
  logger.info(`CAPTCHA ${ip}:${captchaid} timed out`);
  return 1;
}

/*
 * check if captcha is needed
 * @param ip
 * @return boolean true if needed
 */
export async function needCaptcha(ip) {
  if (CAPTCHA_TIME < 0) {
    return false;
  }
  const key = `${PREFIX}:${getIPv6Subnet(ip)}`;
  const ttl = await client.ttl(key);
  if (ttl > 0) {
    return false;
  }
  logger.info(`CAPTCHA ${ip} got captcha`);
  return true;
}

/*
 * force ip to get captcha
 * @param ip
 * @return true if we triggered captcha
 *         false if user would have gotten one anyway
 */
export async function forceCaptcha(ip) {
  if (CAPTCHA_TIME < 0) {
    return null;
  }
  const key = `${PREFIX}:${getIPv6Subnet(ip)}`;
  const ret = await client.del(key);
  return (ret > 0);
}
