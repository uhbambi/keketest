/*
 * logout
 */

import logger from '../../../core/logger';
import { closeSession } from '../../../middleware/session';

export default async (req, res) => {
  const { user } = req;

  // eslint-disable-next-line max-len
  logger.info(`AUTH: Logged out user ${user.name}(${user.id}) by ${req.ip.ipString}`);

  await closeSession(req, res);

  res.status(200);
  res.json({
    success: true,
  });
};
