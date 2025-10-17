/*
 * OIDC Refresh Tokens
 * tokens used to get new access tokens, they are single-use and grant a new
 * refresh token each time.
 */

import Sequelize, { DataTypes, QueryTypes, Op } from 'sequelize';

import sequelize from './sequelize.js';
import { generateLargeToken } from '../../utils/hash.js';

const OIDCRefreshToken = sequelize.define('OIDCRefreshToken', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /*
   * OIDC Consent
   */
  cid: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  token: {
    type: DataTypes.CHAR(80),
    allowNull: false,
    unique: 'token',
    defaultValue: generateLargeToken,
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
   * a month or so, gets rerolled whenever a new refresh token gets requested
   */
  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default OIDCRefreshToken;
