/**
 * send initial data to player
 */

import getMe from '../../core/me';
import { touch } from '../../middleware/touch';

export default async (req, res, next) => {
  const { ip, user, lang } = req;
  /* trigger getIPAllowance to ensure it is ready when ws request comes */
  req.ip.getAllowance();
  /* trigger timestamp updates */
  if (user) {
    user.touch(ip.ipString);
  }
  ip.touch();

  try {
    const userdata = await getMe(user, lang);
    res.json(userdata);
  } catch (error) {
    next(error);
  }
};
