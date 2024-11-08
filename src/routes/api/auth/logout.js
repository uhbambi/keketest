/*
 * logout
 */

import logger from '../../../core/logger';
import { getIPFromRequest } from '../../../utils/ip';

export default async (req, res) => {
  const { user } = req;
  const { t } = req.ttag;
  if (!user || !user.regUser) {
    res.status(401);
    res.json({
      errors: [t`You are not even logged in.`],
    });
    return;
  }

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Logged out user ${user.regUser.name}(${user.id}) by ${getIPFromRequest(req)}`);

  req.logout((err) => {
    if (err) {
      res.status(500);
      res.json({
        errors: [t`Server error when logging out.`],
      });
      return;
    }
    res.status(200);
    res.json({
      success: true,
    });
  });
};
