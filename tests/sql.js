import { sequelize, sync as syncSql } from '../src/data/sql/index.js';
import { DailyCron, HourlyCron } from '../src/utils/cron.js';
import { getIPAllowance } from '../src/data/sql/IP.js';
import { IP } from '../src/middleware/ip.js';

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

(async () => {
  await initialize();

  console.log(await getIPAllowance('127.0.0.1'));
  const ip = new IP({ connection: { remoteAddress: '127.0.0.1' } });
  console.log(await ip.getAllowance());

  await destruct();
})();
