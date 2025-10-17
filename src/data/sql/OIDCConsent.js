/*
 * Given User Consent,
 * remembered to silently approve of previously given allowances again
 */

import Sequelize, { DataTypes, QueryTypes, Op } from 'sequelize';

import sequelize from './sequelize.js';

const OIDCConsent = sequelize.define('OIDCConsent', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /*
   * User
   */
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  /*
   * OIDC Client
   */
  cid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  /*
   * scope actually requested for that user (subset of scope of client)
   */
  scope: {
    type: DataTypes.TEXT,
    defaultValue: 'openid email profile',
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  /*
   * user defined, same as refreshToken expiresMax
   */
  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default OIDCConsent;
