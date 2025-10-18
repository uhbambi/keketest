/*
 * OIDC Authorization Codes,
 * those are codes given to the user on the login page, that he transfers to the
 * replying party (client), which the client then uses to request tokens.
 * They are single-time use.
 */

import Sequelize, { DataTypes, QueryTypes, Op } from 'sequelize';

import sequelize from './sequelize.js';
import { generateLargeToken } from '../../utils/hash.js';

const OIDCAuthCode = sequelize.define('OIDCAuthCode', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
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

  code: {
    type: DataTypes.CHAR(80),
    allowNull: false,
    unique: 'code',
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

  pkceChallenge: {
    type: DataTypes.STRING(255),
  },

  pkceMethod: {
    type: DataTypes.STRING(10),
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  /*
   * short-lived (minutes)
   */
  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

/**
 * create new Auth Code
 * @param consentId OIDCConsent id
 * @param scope array of scopes
 * @param pkceChallenge | null
 * @param pkceMethod | null
 * @return code Authorization Code
 */
export async function createAuthCode(
  consentId, scope, pkceChallenge = null, pkceMethod = null,
) {
  try {
    const code = generateLargeToken();
    await sequelize.query(
      /*
       * minimum 10 minues expiration time is OIDC recommendation
       */
      // eslint-disable-next-line max-len
      'INSERT INTO OIDCAuthCodes (cid, code, scope, pkceChallenge, pkceMethod, expires) VALUES (?, ?, ?, ?, ?, NOW() + INTERVAL 12 MINUTE)', {
        replacements: [
          consentId, code, scope.join(' '), pkceChallenge, pkceMethod,
        ],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return code;
  } catch (error) {
    console.error(`SQL Error on createAuthCode: ${error.message}`);
  }
  return null;
}

export default OIDCAuthCode;
