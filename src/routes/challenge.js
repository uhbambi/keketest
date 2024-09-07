/*
 * route providing javascript challenge
 */
import logger from '../core/logger';
import requestChallenge from '../core/challengeserver';
import { getIPFromRequest } from '../utils/ip';
import { setChallengeSolution } from '../data/redis/captcha';

async function challenge(req, res) {
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Content-Type': 'application/javascript; charset=UTF-8',
  });

  requestChallenge((error, solution, data) => {
    try {
      if (error) {
        throw new Error(error);
      }

      const ip = getIPFromRequest(req);
      setChallengeSolution(solution, ip, req.headers['user-agent']);
      logger.info(`CHALLENGE ${ip} got challenge with solution: ${solution}`);
      res.end(data);
    } catch (err) {
      if (!res.writableEnded) {
        res.status(503);
        res.send(
          // eslint-disable-next-line max-len
          'console.log(\'JS Challenged experienced an server error 503\');',
        );
      }
      logger.warn(err.message);
    }
  });
}

export default challenge;
