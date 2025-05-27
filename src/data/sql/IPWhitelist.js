/**
 *
 */

import { DataTypes } from 'sequelize';
import sequelize from './sequelize';


const IPWhitelist = sequelize.define('IPWhitelist', {
  reason: {
    type: DataTypes.STRING(200),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    allowNull: false,
    set(value) {
      this.setDataValue('reason', value.slice(0, 200));
    },
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/*
 * check if ip is whitelisted
 * @param ip
 * @return boolean
 */
export async function isWhitelisted(ip) {
  const count = await IPWhitelist
    .count({
      where: { ip },
    });
  return count !== 0;
}

/*
 * whitelist ip
 * @param ip
 * @return true if whitelisted,
 *         false if it was already whitelisted
 */
export async function whitelistIP(ip) {
  const [, created] = await IPWhitelist.findOrCreate({
    where: { ip },
  });
  return created;
}

/*
 * remove ip from whitelist
 * @param ip
 * @return true if unwhitelisted,
 *         false if ip wasn't whitelisted anyway
 */
export async function unwhitelistIP(ip) {
  const count = await IPWhitelist.destroy({
    where: { ip },
  });
  return !!count;
}

export default IPWhitelist;
