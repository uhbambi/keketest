import fs from 'fs';
import { QueryTypes, DataTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { addImageHash } from './ImageHash.js';
import { getRandomShortId } from '../../core/utils.js';
import {
  constructMediaPath, getThumbnailPaths,
} from '../../utils/media/serverUtils.js';

const Media = sequelize.define('Media', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  hash: {
    type: 'BINARY(32)',
    unique: 'hash',
    allowNull: false,
  },

  /*
   * SELECT
   i d,  *
   filename,
   BIT_COUNT(phash ^ @target_hash) AS hamming_distance,
                               phash
                               FROM images
                               WHERE BIT_COUNT(phash ^ @target_hash) <= 5
                               ORDER BY hamming_distance
                               LIMIT 20;
  */

  /*
   * short identifier for file, will be 6 chars usually, but can be more
   */
  shortId: {
    type: DataTypes.STRING(16),
    allowNull: false,
  },

  extension: {
    type: DataTypes.STRING(12),
    allowNull: false,
  },

  mimeType: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },

  /*
   * 'image', 'audio', 'video', etc.
   */
  type: {
    type: DataTypes.STRING(128),
    allowNull: false,
  },

  size: {
    type: DataTypes.INTEGER.UNSIGNED,
  },

  /*
   * from lowest to highest bit:
   * 0: registeredUsersOnly (if only registered users can view it)
   * 1: allowCORS (if allowing cors)
   * 2: needsApproval
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  /*
   * count active references, may or may not be used
   */
  refCounter: {
    type: DataTypes.INTEGER.UNSIGNED,
    defaultValue: 0,
    allowNull: false,
  },

  /*
   * time to expire, NULL if infinite
   */
  expires: {
    type: DataTypes.DATE,
  },

  /*
   * time a file has been uploaded, may be updated on reupload or check
   */
  lastUpload: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [{
    unique: true,
    name: 'filename',
    fields: ['shortId', 'extension'],
  }, {
    name: 'hashtype',
    fields: ['hash', 'mimeType'],
  }],
});


export async function deregisterMedia(shortId, extension) {
  try {
    console.log(`MEDIA: deregister ${shortId} ${extension}`);
    await sequelize.query(
      'DELETE FROM Media WHERE shortId = ? AND extension = ?', {
        replacements: [shortId, extension],
        type: QueryTypes.DELETE,
        raw: true,
      });
    const filePath = constructMediaPath(shortId, extension);
    if (fs.existsSync(filePath)) {
      fs.rmSync(filePath);
    }
    const { thumbFilePath, iconFilePath } = getThumbnailPaths(filePath);
    if (fs.existsSync(thumbFilePath)) {
      fs.rmSync(thumbFilePath);
    }
    if (fs.existsSync(iconFilePath)) {
      fs.rmSync(iconFilePath);
    }
  } catch (error) {
    console.error(`SQL Error on deregisterMedia: ${error.message}`);
  }
}

/**
 * get filename of media if exists, adds 'shortId', 'existed' and 'extension'
 * to hashes objects where a corresponding hash exists
 * @param hashes [{
 *   hash,
 *   name,
 *   mimeType,
 *   extension,
 *   originalFilename,
 * }, ...]
 * @return success boolean
 */
export async function hasMedia(hashes) {
  if (!hashes) {
    return true;
  }
  if (!Array.isArray(hashes)) {
    hashes = [hashes];
  }
  if (!hashes.length) {
    return true;
  }

  try {
    const replacements = [];
    for (let i = 0; i < hashes.length; i += 1) {
      const { hash } = hashes[i];
      if (hash) {
        replacements.push(hashes[i].hash, hashes[i].mimeType);
      }
    }

    const mediaModels = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT id, LOWER(HEX(hash)) AS hash, mimeType, extension, shortId FROM Media WHERE ${
        hashes.map(
          () => '( hash = UNHEX(?) AND mimeType = ? )',
        ).join(' OR ')
      }`, {
        replacements,
        type: QueryTypes.SELECT,
        raw: true,
      },
    );

    if (mediaModels.length) {
      /*
       * upldate lastUpload timestamp, if we would be on MariaDB only, we could
       * use RETURNING and merge it together with the SELECT query
       */
      sequelize.query(
        `UPDATE Media SET lastUpload = NOW() WHERE id IN (${
          mediaModels.map(() => '?').join(', ')
        })`, {
          replacements: mediaModels.map((model) => model.id),
          type: QueryTypes.UPDATE,
        },
      ).catch((error) => {
        console.error(`SQL Error on hasMedia: ${error.message}`);
      });

      for (let i = 0; i < mediaModels.length; i += 1) {
        const model = mediaModels[i];
        const hash = hashes.find(
          (h) => h.hash === model.hash && h.mimeType === model.mimeType,
        );
        if (hash) {
          /*
           * make sure that file actually exists
           */
          const filePath = constructMediaPath(model.shortId, model.extension);
          if (fs.existsSync(filePath)) {
            hash.extension = model.extension;
            hash.shortId = model.shortId;
            hash.mediaId = `${model.shortId}:${model.extension}`;
            hash.existed = true;
          } else {
            deregisterMedia(model.shortId, model.extension);
          }
        }
      }
    }
  } catch (error) {
    console.error(`SQL Error on hasMedia: ${error.message}`);
    return false;
  }
  return true;
}

/**
 * lnk media to user and / or ip
 * @param shortId
 * @param extension
 * @param [userId]
 * @param [ip]
 */
export async function linkMedia(models, userId, ip) {
  if (!models) {
    return;
  }
  if (!Array.isArray(models)) {
    models = [models];
  }
  const flattenedModels = [];
  let where = '';
  for (let i = 0; i < models.length; i += 1) {
    const { shortId, extension } = models[i];
    if (shortId && extension) {
      flattenedModels.push(shortId, extension);
      if (where) {
        where += ' OR ';
      }
      where += '( m.shortId = ? AND m.extension = ? )';
    }
  }
  if (!flattenedModels.length) {
    return;
  }

  try {
    const promises = [];
    if (userId) {
      promises.push(sequelize.query(
      // eslint-disable-next-line max-len
        `INSERT IGNORE INTO UserMedia (uid, mid) SELECT ?, m.id FROM Media m WHERE ${where}`, {
          replacements: [userId, ...flattenedModels],
          raw: true,
          type: QueryTypes.INSERT,
        }));
    }
    if (ip) {
      promises.push(sequelize.query(
      // eslint-disable-next-line max-len
        `INSERT IGNORE INTO IPMedia (ip, mid) SELECT IP_TO_BIN(?), m.id FROM Media m WHERE ${where}`, {
          replacements: [ip, ...flattenedModels],
          raw: true,
          type: QueryTypes.INSERT,
        }));
    }
    await Promise.all(promises);
  } catch (error) {
    console.error(`SQL Error on linkMedia: ${error.message}`);
  }
}

/**
 * register new media, adds 'shortId' and 'existed' to given model object
 * @param model { hash, mimeType, extension }
 * @return success boolean
 */
export async function registerMedia(
  model, type, size, pHash = null,
) {
  const { hash, mimeType, extension } = model;
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
        'SELECT 1 FROM Media WHERE shortId = ? AND extension = ?', {
          replacements: [shortId, extension],
          plain: true,
          type: QueryTypes.SELECT,
        },
      );
      console.log('roll', shortId);
    } while (exists);
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO Media (hash, shortId, extension, mimeType, type, size, lastUpload) VALUES (UNHEX(?), ?, ?, ?, ?, ?, NOW()) ON DUPLICATE KEY UPDATE lastUpload = VALUES(lastUpload)', {
        replacements: [
          hash, shortId, extension, mimeType, type, size,
        ],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    if (type === 'image' && pHash) {
      await addImageHash(shortId, extension, pHash);
    }
    model.shortId = shortId;
    model.existed = false;
    model.mediaId = `${shortId}:${extension}`;
    return true;
  } catch (error) {
    console.error(`SQL Error on registerMedia: ${error.message}`);
  }
  return false;
}

/**
 * get type of media by mediaId
 * @param mediaId
 * @return 'image' | 'video' | ... or null if not exists
 */
export async function getMediaType(mediaId) {
  try {
    const [shortId, extension] = mediaId.split(':');
    if (!shortId || !extension) {
      return null;
    }
    const model = await sequelize.query(
      'SELECT type FROM Media WHERE shortId = ? AND extension = ?', {
        replacements: [shortId, extension],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return model?.type;
  } catch (err) {
    console.error('SQL Error on getMediaType:', err.message);
    return null;
  }
}

export default Media;
