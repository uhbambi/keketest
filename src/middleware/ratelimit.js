/*
 * rate limiter,
 * must have req.ip available
 */
import MassRateLimiter from '../utils/MassRateLimiter.js';
import { HOUR } from '../core/constants.js';

const rateLimiter = new MassRateLimiter(HOUR);

function onTrigger(ipString) {
  console.warn(`User ${ipString} triggered Request RateLimit.`);
}

export default (req, res, next) => {
  if (rateLimiter.isTriggered(req.ip.ipString)) {
    res.status(429).send(`<!DOCTYPE html>
<html>
  <head><title>Too fast</title></head>
  <body>Calm Down a bit.</body>
</html>`);
    return;
  }
  req.tickRateLimiter = (deltaTime) => {
    /*
     * the ticking request will be answered, if the limiter triggers, the next
     * request is the first to be caught
     */
    rateLimiter.tick(req.ip.ipString, deltaTime, null, onTrigger);
  };
  next();
};
