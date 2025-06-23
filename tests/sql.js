import { sequelize, sync as syncSql } from '../src/data/sql/index.js';
import { DailyCron, HourlyCron } from '../src/utils/cron.js';
import { getIPAllowance, getIPsOfIIDs, getIIDsOfIPs, getIPofIID, getIIDofIP, touchIP } from '../src/data/sql/IP.js';
import { getBanInfos } from '../src/data/sql/Ban.js';
import { resolveSession, createSession } from '../src/data/sql/Session.js';
import { getUsersByNameOrEmail, setPassword, setUserLvl } from '../src/data/sql/User.js';
import { notifyUserIpChanges, ban } from '../src/core/ban.js';
import { IP } from '../src/middleware/ip.js';
import { User } from '../src/middleware/session.js';
import { USERLVL } from '../src/core/constants.js';

async function initialize() {
  await syncSql(false);
  sequelize.options.logging = (sql, timing) => {
    console.log(sql);
  };
}

async function destruct() {
  await sequelize.close();
  DailyCron.destructor();
  HourlyCron.destructor();
}

async function ipMapping() {
  console.log('GET IPs OF IIDs');
  console.log(await getIPsOfIIDs(['5c1f6618-4f8e-11f0-8cca-b61fc4d778f0', '90ccd90a-c3e2-53d0-e889-c59c39cf9b45']));
  console.log(await getIPsOfIIDs('90ccd90a-c3e2-53d0-e889-c59c39cf9b45'));
  console.log('GET IIDs OF IPs');
  console.log(await getIIDsOfIPs(['127.0.0.1', '127.0.0.5']));
  console.log(await getIIDsOfIPs('127.0.0.5'));
  console.log('GET INDIVIDUAL IP');
  console.log(await getIPofIID('5c1f6618-4f8e-11f0-8cca-b61fc4d778f0'));
  console.log('GET INDIVIDUAL IID');
  console.log(await getIIDofIP('127.0.0.1'));
  console.log('TOUCH IP');
  console.log(await touchIP('127.0.0.1'));
}

(async () => {
  await initialize();

  await ipMapping();
  /*
  const ip = new IP({ connection: { remoteAddress: '127.0.0.1' } });
  console.log(await ip.getAllowance());

  const token = await createSession(5, 5);
  const session = await resolveSession(token);
  const user = new User(session);
  console.log(session);
  console.log(await user.getAllowance());
  console.log(await getBanInfos('127.0.0.1', 3, null, null));

  console.log('==== getUsersByNameOrEmail ====');
  const userdata = (await getUsersByNameOrEmail('test2', null))[0];
  const uid = userdata.id;
  console.log(userdata);
  const token = await createSession(uid, 5);
  notifyUserIpChanges(null, uid);
  console.log(await setPassword(uid, 'asdfasdf'));
  console.log(await setUserLvl(uid, USERLVL.MOD));
  console.log('Session Token:', token);
  console.log('==== resolveSession ====');
  console.log(await resolveSession(token));
  console.log('==== getIPAllowance ====');
  console.log(await getIPAllowance('127.0.0.1'));
  console.log('==== ban user ====');
  // console.log(await ban(null, 6, null, false, true, 'just because', null, null));
  console.log(await getBanInfos('127.0.0.1', null, null, 5, true))
*/

  await destruct();
})();
