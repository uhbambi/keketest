/**
 * send initial data to player
 */

import getMe from '../../core/me.js';

export default async (req, res) => {
  req.tickRateLimiter(1000);

  const { ip, user, lang } = req;
  const userdata = await getMe(user, ip, lang);

  res.json(userdata);
};
