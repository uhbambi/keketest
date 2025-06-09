import { touchUser } from '../data/sql/User';

/**
 * update lastSeen timestamps in both user and ip
 * @param user null | user object according to middlewar/session.js
 * @param ip ip object of middleware/ip.js
 */
export function touch(user, ip) {
  const promises = [];
  promises.push(ip.touch());
  if (user?.lastSeen.getTime() > Date.now() - 10 * 60 * 1000) {
    promises.push(touchUser(user.id, ip.ipString));
  }
  Promise.all(promises).catch((error) => {
    console.error(`ExpressJs Error on touch: ${error.message}`);
  });
}

/*
 * exporess middleware to update lastSeen timestamps
 */
export default (req, res, next) => {
  if (req.ip) {
    touch(req.user, req.ip);
  }
  next();
};
