/*
 *
 * block all private messages
 *
 */
import logger from '../../core/logger';

async function privatize(req, res) {
  const { priv } = req.body;
  const { user } = req;

  if (typeof priv !== 'boolean') {
    res.status(400).json({
      errors: ['Not defined if setting or unsetting private'],
    });
    return;
  }

  logger.info(
    `User ${user.name} set private status to ${priv}`,
  );

  await user.regUser.update({
    priv,
  });

  res.json({
    status: 'ok',
  });
}

export default privatize;
