import { sync as syncSql } from '../src/data/sql/sequelize.js';

syncSql().then(() => {
  console.log('ya');
});
