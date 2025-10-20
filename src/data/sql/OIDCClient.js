/*
 * store OIDC Relying Parties aka Clients aka other websites wanting to use our login
 */

import { DataTypes, QueryTypes } from 'sequelize';

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
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(255)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    defaultValue: 'openid profile email',
    allowNull: false,
  },

  /*
   * scopes used when no scope is given
   */
  defaultScope: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(255)} CHARACTER SET ascii COLLATE ascii_general_ci`,
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

  lastUsed: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/**
 * get OIDC client
 * @param uuid client uuid, named client_id in auth requests
 * @return clientModel {
 *   id,
 *   name,
 *   secret,
 *   scope: array of allowed scopes,
 *   defaultScope: array of default scopes,
 *   redirectUris: array of allowed redirect uris,
 *   autoGrant,
 * }
 */
export async function getOIDCClient(uuid) {
  if (!uuid) {
    return null;
  }
  try {
    const clientModel = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT id, name, secret, redirectUris, scope, defaultScope, autoGrant FROM OIDCClients WHERE uuid = UUID_TO_BIN($1)', {
        bind: [uuid],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (clientModel) {
      clientModel.scope = clientModel.scope.split(' ');
      if (clientModel.defaultScope) {
        clientModel.defaultScope = clientModel.scope.split(' ');
      }
      clientModel.redirectUris = clientModel.redirectUris.split(' ');
      return clientModel;
    }
  } catch (error) {
    console.error(`SQL Error on getOIDCClient: ${error.message}`);
  }
  return null;
}

export async function touchOIDCClient(id) {
  try {
    await sequelize.query(
      'UPDATE OIDCClients SET lastUsed = NOW() WHERE id = $1', {
        bind: [id],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
  } catch (error) {
    console.error(`SQL Error on touchOIDCClient: ${error.message}`);
  }
}

export default OIDCClient;
