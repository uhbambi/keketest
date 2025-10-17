/*
 * store OIDC Relying Parties aka Clients aka other websites wanting to use our login
 */

/*
 * recommended indexes
 CREATE INDEX idx_auth_codes_client_user ON oidc_authorization_codes(client_id, user_id);
 CREATE INDEX idx_access_tokens_token ON oidc_access_tokens(token);
 CREATE INDEX idx_access_tokens_user_client ON oidc_access_tokens(user_id, client_id);
 CREATE INDEX idx_refresh_tokens_token ON oidc_refresh_tokens(token);
 CREATE INDEX idx_auth_codes_expires ON oidc_authorization_codes(expires_at);
*/

import Sequelize, { DataTypes, QueryTypes, Op } from 'sequelize';

import sequelize from './sequelize.js';
import { generateUUID, generateToken } from '../../utils/hash.js';

const OIDCClient = sequelize.define('OIDCClient', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: 'username',
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
    defaultValue: generateUUID,
  },

  secret: {
    type: DataTypes.CHAR(40),
    allowNull: false,
    unique: 'secret',
    defaultValue: generateToken,
  },

  /*
   * space seperated list of uris
   */
  redirectUris: {
    type: `${DataTypes.TEXT} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
  },

  /*
   * max scopes that client is allowed, user then can choose a subset
   */
  scope: {
    type: DataTypes.TEXT,
    defaultValue: 'openid email profile',
    allowNull: false,
  },

  /*
   * how we exchange information
   */
  grantTypes: {
    type: DataTypes.STRING(500),
    defaultValue: 'authorization_code refresh_token',
    allowNull: false,
  },

  /*
   * whether we automatically grant every request, ONLY use this for own
   * services on same domain
   */
  autoGrant: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export default OIDCClient;
