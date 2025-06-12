/**
 * send initial data to player
 */

import getMe from '../../core/me';
import { touch } from '../../middleware/touch';

export default async (req, res, next) => {
  /* trigger getIPAllowance to ensure it is ready when ws request comes */
  req.ip.getIPAllowance();

  try {
    const { user, lang } = req;
    touch(user, req.ip);
    const userdata = await getMe(user, lang);
    res.json(userdata);
  } catch (error) {
    next(error);
  }
};
