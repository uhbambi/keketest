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

  scope: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(255)} CHARACTER SET ascii COLLATE ascii_general_ci`,
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

/**
 * create new Access Token
 * @param consentId OIDCConsent id
 * @param scope array of scopes
 * @return token
 */
export async function createAccessToken(consentId, scope) {
  try {
    const token = generateLargeToken();
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO OIDCAccessTokens (cid, token, scope, expires, createdAt) VALUES (?, ?, ?, NOW() + 1 HOUR, NOW())', {
        replacements: [consentId, token, scope.sort().join(' ')],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return token;
  } catch (error) {
    console.error(`SQL Error on createAccessToken: ${error.message}`);
  }
  return null;
}

export default OIDCAccessToken;
