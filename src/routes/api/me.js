/**
 * send initial data to player
 */

import getMe from '../../core/me.js';

export default async (req, res) => {
  req.tickRateLimiter(3000);

  const { ip, user, lang } = req;
  const userdata = await getMe(user, ip, lang);

  /*
   * trigger timestamp updates after getMe finished,
   * because getMe ensures that IP exist in table
   */
  if (user) {
    user.touch(ip.ipString);
  }
  ip.touch();

  res.json(userdata);
};
