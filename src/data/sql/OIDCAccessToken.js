/*
 * OIDC Access Tokens
 * those are tokens with which the relying party (client) can request actual
 * use data, they are short-lived
 */

import Sequelize, { DataTypes, QueryTypes, Op } from 'sequelize';

import sequelize from './sequelize.js';
import { generateLargeToken } from '../../utils/hash.js';

const OIDCAccessToken = sequelize.define('OIDCAccessToken', {
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
   * short-lived (hours)
   */
  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

export default OIDCAccessToken;
