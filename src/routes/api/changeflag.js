/*
* change custom flag in chat
*/
import { createCustomFlag } from '../../data/sql/CustomFlag.js';
import socketEvents from '../../socket/socketEvents.js';

async function changeflag(req, res) {
  req.tickRateLimiter(10000);

  const { user } = req;
  const { code } = req.body;

  console.log('changeflag', user?.id, code);
  if (!user.id) {
    res.status(400).json({
      errors: ['user not defined'],
    });
    return;
  }
  if (!code) {
    res.status(400).json({
      errors: ['code not defined'],
    });
    return;
  }
  if (code.length < 2 || code.length > 3) {
    res.status(400).json({
      errors: ['code length is invalid'],
    });
    return;
  }
  if (!/[a-zA-Z]{2,3}/.test(code) || code === 'zz') {
    res.status(400).json({
      errors: ['invalid code'],
    });
    return;
  }
  const success = await createCustomFlag(user.id, code);

  if (!success) {
    res.status(400).json({
      errors: ['something went wrong'],
    });
    return;
  }
  socketEvents.reloadUser(user.id);
  res.json({
    status: 'ok',
  });
}

export default changeflag;
