/*
 * store OIDC Relying Parties aka Clients aka other websites wanting to use our login
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { generateUUID, generateToken, bufferToUUID } from '../../utils/hash.js';

const OIDCClient = sequelize.define('OIDCClient', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /*
   * user that created this client
   */
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: true,
  },

  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: 'name',
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

/**
 * update the last used time of a client
 * @param id integer id of the client
 */
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

/**
 * create new OIDC client
 * @param uid userId of whoever registers the client
 * @param scope Array of wanted scopes
 * @param redirectUris Array of accepted redirect urls
 * @param rerollSecret whether or not we generate a new secret on client change
 * @return {
 *   clientSecret,
 *   clientId: the uuid for the client, not the integer id,
 * }
 */
export async function createOIDCClient(
  uid, name, scope, redirectUris, defaultScope = null, uuid = null,
  rerollSecret = false,
) {
  scope = scope.sort().join(' ');
  redirectUris = redirectUris.join(' ');

  try {
    const existingClients = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT name, id, secret, BIN_TO_UUID(uuid) AS uuid, secret FROM OIDCClients WHERE uid = ?', {
        replacements: [uid],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    for (let i = 0; i < existingClients.length; i += 1) {
      const client = existingClients[i];
      if (client && (client.name === name || client.uuid === uuid)) {
        /* user already has this client registered */
        const secret = (rerollSecret) ? generateToken() : client.secret;
        // eslint-disable-next-line no-await-in-loop
        await sequelize.query(
          // eslint-disable-next-line max-len
          'UPDATE OIDCClients SET name = ?, redirectUris = ?, scope = ?, defaultScope = ?, secret = ? WHERE id = ?', {
            replacements: [
              name, redirectUris, scope, defaultScope, secret, client.id,
            ],
            raw: true,
            type: QueryTypes.UPDATE,
          },
        );
        return {
          clientSecret: secret,
          clientId: client.uuid,
        };
      }
    }
    if (uuid) {
      throw new Error('No such client exists or you do not have access to it');
    }

    const secret = generateToken();

    while (!uuid) {
      uuid = bufferToUUID(generateUUID());
      // eslint-disable-next-line no-await-in-loop
      const existingClient = await sequelize.query(
        // eslint-disable-next-line max-len
        'SELECT id, BIN_TO_UUID(uuid) AS uuid FROM OIDCClients WHERE uuid = UUID_TO_BIN(?) OR name = ?', {
          replacements: [uuid, name],
          plain: true,
          type: QueryTypes.SELECT,
        },
      );
      if (existingClient && existingClient.uuid === uuid) {
        uuid = null;
      }
      if (existingClient && existingClient.name === name) {
        throw new Error('OIDC Client with this name already exists');
      }
    }
    console.log('chode uuid', [
      name, uuid, secret, redirectUris, scope, null, false,
    ]);

    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO OIDCClients (uid, name, uuid, secret, redirectUris, scope, defaultScope, autoGrant, createdAt) VALUES (?, ?, UUID_TO_BIN(?), ?, ?, ?, ?, ?, NOW())', {
        replacements: [
          uid, name, uuid, secret, redirectUris, scope, null, false,
        ],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return { clientSecret: secret, clientId: uuid };
  } catch (error) {
    console.error(`SQL Error on createOIDCClient: ${error.message}`);
  }
  return null;
}

export default OIDCClient;
