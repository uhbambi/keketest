import { sequelize, sync as syncSql, cleanDB } from '../src/data/sql/index.js';
import { DailyCron, HourlyCron } from '../src/utils/cron.js';
import { generateIdToken } from '../src/middleware/oidc.js';
const LOG_QUERY = false;
const SYNC_MYSQL = false;

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
  await syncSql(SYNC_MYSQL);
}

async function destruct() {
  await sequelize.close();
  DailyCron.destructor();
  HourlyCron.destructor();
}


(async () => {
  await initialize();

  let lsql;
  sequelize.options.logging = (sql, timing) => {
    if (LOG_QUERY) {
      console.log(sql);
    }
    lsql = sql;
  };

  try {
    title('generateIdToken');

    console.log(await generateIdToken(8, 1, ['openid', 'profile', 'email'], {}));

    title('Clean DB');
    await cleanDB();
  } catch (error) {
    console.error(error.message);
    console.error(lsql);
  }

  await destruct();
})();
