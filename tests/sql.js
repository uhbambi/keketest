import { QueryTypes } from 'sequelize';
import { sequelize, sync as syncSql } from '../src/data/sql/index.js';
import { DailyCron, HourlyCron } from '../src/utils/cron.js';
import { getIPAllowance, getIPsOfIIDs, getIIDsOfIPs, getIPofIID, getIIDofIP, touchIP } from '../src/data/sql/IP.js';
import { getBanInfos } from '../src/data/sql/Ban.js';
import { resolveSession, createSession } from '../src/data/sql/Session.js';
import { getUsersByNameOrEmail, setPassword, setUserLvl, createNewUser } from '../src/data/sql/User.js';
import { setEmail, getTPIDsOfUser } from '../src/data/sql/ThreePID.js';
import { createDMChannel, deleteDMChannel, deleteChannel } from '../src/data/sql/Channel.js';
import { notifyUserIpChanges, ban } from '../src/core/ban.js';
import { sanitizeIPString, ipToHex, hexToIP } from '../src/utils/intel/ip.js';
import { blockUser, unblockUser, isUserBlockedBy } from '../src/data/sql/association_models/UserBlock.js';
import { IP } from '../src/middleware/ip.js';
import { User } from '../src/middleware/session.js';
import { USERLVL } from '../src/core/constants.js';

function title(title, spacer = '=') {
  const spacerAmount = Math.floor((80 - title.length - 2) / 2);
  let out = spacer.repeat(spacerAmount) + ' ' + title + ' ' + spacer.repeat(spacerAmount);
  if ((80 - title.length - 2) % 2) out += spacer;
  console.log(out);
}

function fail(message, value) {
  console.log(value);
  throw new Error(message);
}

async function initialize() {
  await syncSql(false);
}

async function destruct() {
  await sequelize.close();
  DailyCron.destructor();
  HourlyCron.destructor();
}

async function establishUsers() {
  title('establish Users');
  console.log('Create Users');
  let userdataA = await getUsersByNameOrEmail('testA', 'testA@example.com');
  if (!userdataA.length) {
    userdataA = await createNewUser('testA', 'testtest');
    await setEmail(userdataA.id, 'testA@example.com');
  } else {
    [userdataA] = userdataA;
  }
  let userdataB = await getUsersByNameOrEmail('testB', 'testB@example.com');
  if (!userdataB.length) {
    userdataB = await createNewUser('testB', 'testtest');
    await setEmail(userdataB.id, 'testB@example.com');
  } else {
    [userdataB] = userdataB;
  }
  console.log('Create Sessions');
  const tokena = await createSession(userdataA.id, 5);
  const tokenb = await createSession(userdataB.id, 5);

  console.log('Check email existence');
  let tpids = await getTPIDsOfUser(userdataA.id);
  let emailTpid = tpids.find((t) => t.provider === 1 && t.tpid === 'testA@example.com');
  if (!emailTpid || emailTpid.length > 1) {
    fail('Error: Email didn\'t get set!', emailTpid);
  }
  tpids = await getTPIDsOfUser(userdataB.id);
  emailTpid = tpids.find((t) => t.provider === 1 && t.tpid === 'testB@example.com');
  if (!emailTpid || emailTpid.length > 1) {
    fail('Error: Email didn\'t get set!', emailTpid);
  }

  return {
    uida: userdataA.id,
    uidb: userdataB.id,
    tokena, tokenb,
  }
}

async function ipMapping() {
  title('IP to IID Mapping');
  console.log('Establish IPs');
  const ipv6 = sanitizeIPString('2604::96e0:e121:2b82:29b7:3fa9');
  const ipv4 = sanitizeIPString('127.0.0.5');
  console.log(ipv6, ipToHex(ipv6), hexToIP(ipToHex(ipv6)));
  console.log(ipv4, ipToHex(ipv4), hexToIP(ipToHex(ipv4)));
  await sequelize.query(
    `REPLACE INTO IPs (ip, uuid, lastSeen) VALUES (IP_TO_BIN(?), UUID_TO_BIN('5c1f6618-4f8e-11f0-8cca-b61fc4d778f0'), NOW())`, {
      replacements: [ipv4],
      raw: true,
      type: QueryTypes.REPLACE,
    }
  );
  await sequelize.query(
    `REPLACE INTO IPs (ip, uuid, lastSeen) VALUES (IP_TO_BIN('127.0.0.1'), UUID_TO_BIN('90ccd90a-c3e2-53d0-e889-c59c39cf9b45'), NOW())`, {
      raw: true,
      type: QueryTypes.REPLACE,
    }
  );
  await sequelize.query(
    `REPLACE INTO IPs (ip, uuid, lastSeen) VALUES (IP_TO_BIN(?), UUID_TO_BIN('80ccd90a-c3e2-53d0-e889-c59c39cf9b45'), NOW())`, {
      replacements: [ipv6],
      raw: true,
      type: QueryTypes.REPLACE,
    }
  );
  console.log('Get IPs OF IIDs');
  let out = await getIPsOfIIDs(['5c1f6618-4f8e-11f0-8cca-b61fc4d778f0', '80ccd90a-c3e2-53d0-e889-c59c39cf9b45']);
  if (out.get('5c1f6618-4f8e-11f0-8cca-b61fc4d778f0') !== ipv4 || out.get('80ccd90a-c3e2-53d0-e889-c59c39cf9b45') !== ipv6) {
    fail('multiple getIPsOfIIDs', out);
  }
  out = await getIPsOfIIDs('90ccd90a-c3e2-53d0-e889-c59c39cf9b45');
  if (out.get('90ccd90a-c3e2-53d0-e889-c59c39cf9b45') !== '127.0.0.1') {
    fail('singular getIPsOfIIDs', out);
  }
  console.log('Get IIDs OF IPs');
  out = await getIIDsOfIPs(['127.0.0.1', ipv4]);
  if (out.get(ipv4) !== '5c1f6618-4f8e-11f0-8cca-b61fc4d778f0' || out.get('127.0.0.1') !== '90ccd90a-c3e2-53d0-e889-c59c39cf9b45') {
    fail('singular getIIDsOfIPs', out);
  }
  out = await getIIDsOfIPs(ipv4);
  if (out.get(ipv4) !== '5c1f6618-4f8e-11f0-8cca-b61fc4d778f0') {
    fail('singular getIIDsOfIPs', out);
  }
  console.log('Get individual IP');
  out = await getIPofIID('5c1f6618-4f8e-11f0-8cca-b61fc4d778f0');
  if (out !== ipv4) {
    fail('getIPofIID', out);
  }
  console.log('Get individual IID');
  out = await getIIDofIP('127.0.0.1');
  if (out !== '90ccd90a-c3e2-53d0-e889-c59c39cf9b45') {
    fail('getIIDofIP', out);
  }
  console.log('Touch IP');
  out = await touchIP('127.0.0.1');
  if (!out) {
    fail('Could not touch ip');
  }
}

async function chat(users) {
  title('Chat');
  const { uida, uidb, tokena, tokenb } = users;
  console.log('Create DM channel');
  await deleteDMChannel(uida, uidb);
  const [cid, success] = await createDMChannel(uida, uidb);
  if (!success || !cid) {
    fail('createDMChannel', [cid, success]);
  }
  console.log('Resolve session with DM channel');
  let out = await resolveSession(tokena);
  const info = out.channels[cid];
  if (info[0] !== 'testB' || info[3] !== uidb) {
    fail('Resolve session with DM', out);
  }
  console.log('Block user');
  out = await isUserBlockedBy(uida, uidb);
  if (out) {
    await unblockUser(uida, uidb);
  }
  out = await blockUser(uida,uidb);
  if (!await isUserBlockedBy(uida, uidb)) {
    fail('Could not block user');
  }
  out = await resolveSession(tokena);
  if (!out.blocked.find(({id}) => id === uidb)) {
    fail('User block not in session', out);
  }
}

(async () => {
  await initialize();

  let lsql;
  sequelize.options.logging = (sql, timing) => {
    lsql = sql;
  };

  try {
    const users = await establishUsers();
    await ipMapping();
    await chat(users);
  } catch (error) {
    console.error(error.message);
    console.error(lsql);
  }

  await destruct();
})();
