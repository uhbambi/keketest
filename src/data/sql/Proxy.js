
import { DataTypes } from 'sequelize';

import sequelize from './sequelize';

const ProxyData = sequelize.define('Proxy', {
  /*
   * store when an ip is a proxy, primary key is ip,
   * which is also the foreign key, defined in ./index.js
   */

  isProxy: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
  },

  /*
   * type of proxy: VPN, SOCKS, etc.
   * or it not proxy: Residential, Wireless, Business
   */
  type: {
    type: DataTypes.STRING(20),
    set(value) {
      if (value) this.setDataValue('type', value.slice(0, 20));
    },
  },

  /*
   * operator of vpn if available
   */
  operator: {
    type: DataTypes.STRING(60),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },

  /*
   * city of ip
   */
  city: {
    type: DataTypes.STRING(60),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
  },

  /*
   * how many devices were seen using this ip, approximated by proxycheck.io
   */
  devices: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1,
    allowNull: false,
  },

  /*
   * how many devices were seen using this subnet, approximated by proxycheck.io
   */
  subnetDevices: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 1,
    allowNull: false,
  },

  /*
   * time of last proxycheck
   */
  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default ProxyData;
