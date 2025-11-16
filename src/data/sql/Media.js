import { QueryTypes, DataTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { getRandomShortId } from '../../core/utils.js';

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /*
   * hash is a base64url but lowercase and only a-z  0-9, other chars stripped
   */
  hash: {
    type: 'BINARY(32)',
    unique: 'hash',
    allowNull: false,
  },

  /*
   * short identifier for file
   */
  shortId: {
    type: DataTypes.STRING(6),
    allowNull: false,
  },

  extension: {
    type: DataTypes.STRING(8),
    allowNull: false,
  },

  mimeType: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },

  /*
   * 'audio', 'video', etc.
   */
  type: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },

  size: {
    type: DataTypes.INTEGER.UNSIGNED,
  },

  /*
   * count active references
   */
  refCounter: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    allowNull: false,
  },

  lastUsed: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [{
    unique: true,
    name: 'filename',
    fields: ['shortId', 'mimeType'],
  }],
});

/**
 * get filename of media if exists
 * @param hash
 * @param mimeType
 * @param name only a string that gets passed through
 * @return {
 *   hash,
 *   extension,
 *   mimeType,
 *   shortId,
 *   name,
 * }
 */
export async function hasMedia(hash, mimeType, name) {
  if (!hash || !mimeType) {
    return null;
  }
  console.log('check if media exists', hash);
  try {
    const mediaModel = await sequelize.query(
      // eslint-disable-next-line max-len
      'SELECT extension, shortId FROM Media WHERE hash = UNHEX($1) AND mimeType = $2', {
        bind: [hash, mimeType],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (mediaModel) {
      console.log('media already exists');
      return {
        hash,
        name,
        mimeType,
        shortId: mediaModel.shortId,
        extension: mediaModel.extension,
      };
    }
  } catch (error) {
    console.error(`SQL Error on hasMedia: ${error.message}`);
  }
  return null;
}

/**
 * register new media
 */
export async function registerMedia(
  hash, extension, mimeType, type, size, name,
) {
  try {
    /*
     * shortId is a random 6 character string of a-z
     */
    let shortId;
    let exists;
    do {
      shortId = getRandomShortId();
      // eslint-disable-next-line no-await-in-loop
      exists = await sequelize.query(
        'SELECT 1 FROM Media WHERE shortId = ?', {
          replacements: [shortId],
          plain: true,
          type: QueryTypes.SELECT,
        },
      );
      console.log('roll', shortId)
    } while (exists);
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO Media (hash, shortId, extension, mimeType, type, size, lastUsed) VALUES (UNHEX(?), ?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE lastUsed = VALUES(lastUsed)', {
        replacements: [hash, shortId, extension, mimeType, type, size],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return {
      hash,
      name,
      mimeType,
      shortId,
      extension,
    };
  } catch (error) {
    console.error(`SQL Error on registerMedia: ${error.message}`);
  }
  return null;
}

export default Media;
