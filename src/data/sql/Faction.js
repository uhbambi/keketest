/*
 * factions
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize, { nestQuery } from './sequelize.js';
import { generateUUID, bufferToUUID } from '../../utils/hash.js';
import {
  FACTION_FLAGS, USER_FACTION_FLAGS, FACTIONLVL, CHANNEL_TYPES,
  MAX_FACTIONS_PER_USER, MAX_OWNED_FACTIONS_PER_USER,
} from '../../core/constants.js';

const Faction = sequelize.define('Faction', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
  },

  /*
   * id of default faction role that gets assigned to new members
   */
  defaultRole: {
    type: DataTypes.BIGINT.UNSIGNED,
  },

  /* [a-zA-Z0-9._-] */
  name: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(32)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
    unique: 'name',
  },

  title: {
    type: `${DataTypes.STRING(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
  },

  description: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(1000)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    defaultValue: '',
    allowNull: false,
  },

  /*
   * faction chat channel,
   * user membership of those channels is still managed in UserChannels
   * seperately.
   * Factions are an addition to channels, not backed in.
   */
  cid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  avatar: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

  /*
   * from lowest to highest bit, see FACTION_FLAGS:
   * 0: priv (if faction is unfindable)
   * 1: public (if everybody can join without invite)
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [{
    name: 'faction_title',
    fields: ['title'],
  }],
});

/**
 * get factions of a user
 * @param uid user id
 * @param isOwnProfile if the information is given to the user itself, if not,
 *   we have to hide hidden factions
 * @return {
 *   factions: [{
 *     fid,
 *     name,
 *     title,
 *     description,
 *     isPrivate,
 *     isPublic,
 *     isHidden,
 *     avatarId,
 *     roles: [{
 *       frid,
 *       name,
 *       customFlagId,
 *       factionlvl,
 *       isMember,
 *     }, ...],
 *   }, ...],
 *   activeFactionRole,
 *   }
 */
export async function getFactionsOfUser(uid, isOwnProfile) {
  let factions = [];
  let activeFactionRole = null;
  try {
    const [factionModels, activeFactionModel] = await Promise.all([
      /*
       * a user could be member of a faction without having a role, but we
       * disallow that case in routes to avoid confusion
       */
      sequelize.query(
        /* eslint-disable max-len */
        `SELECT BIN_TO_UUID(f.uuid) AS fid, f.name, f.title, f.description, f.flags,
CONCAT(a.shortId, ':', a.extension) AS avatarId,
CONCAT(frm.shortId, ':', frm.extension) AS 'roles.customFlagId',
uf.flags AS userFactionFlags,
BIN_TO_UUID(fr.uuid) AS 'roles.frid',
EXISTS(SELECT 1 FROM UserFactionRoles ufr WHERE ufr.uid = uf.uid AND ufr.frid = fr.id) AS isMember,
ufr.title AS 'roles.title', ufr.factionlvl AS 'roles.factionlvl' FROM Factions f
  INNER JOIN UserFactions uf ON uf.fid = f.id
  LEFT JOIN FactionRole fr ON fr.fid = f.id
  LEFT JOIN Media a ON a.id = f.avatar
  LEFT JOIN Media frm ON frm.id = fr.customFlag
WHERE uf.uid = ?`, {
        /* eslint-enable max-len */
          replacements: [uid],
          raw: true,
          type: QueryTypes.SELECT,
        },
      ),
      sequelize.query(
        `SELECT BIN_TO_UUID(f.uuid) AS fid BIN_TO_UUID(fr.uuid) FROM Factions f
  INNER JOIN FactionRoles fr ON fr.fid = f.id
  INNER JOIN Profiles p ON fr.id = p.activeRole
WHERE p.uid = ?`, {
          replacements: [uid],
          plain: true,
          type: QueryTypes.SELECT,
        },
      ),
    ]);
    if (factionModels) {
      let activeFid;
      if (activeFactionModel) {
        activeFid = activeFactionModel.fid;
        activeFactionRole = activeFactionModel.frid;
      }
      factions = nestQuery(factionModels);

      for (let i = 0; i < factions.length; i += 1) {
        const model = factions[i];
        // whether or not searchable
        model.isPrivate = (model.flags & (0x01 << FACTION_FLAGS.PRIV)) !== 0;
        // whether or not joinable without invite
        model.isPublic = (model.flags & (0x01 << FACTION_FLAGS.PUBLIC)) !== 0;
        model.isHidden = false;
        if (model.userFactionFlags) {
          if (model.userFactionFlags & (0x01 << USER_FACTION_FLAGS.HIDDEN)) {
            if (model.fid === activeFid && !isOwnProfile) {
              activeFactionRole = null;
            }
            model.isHidden = true;
          }
          delete model.userFactionFlags;
        }
        delete model.flags;

        if (!model.roles) {
          model.roles = [];
        }
      }

      /* filter for public */
      if (!isOwnProfile) {
        factions = factions.filter((m) => !m.isHidden);
      }
    }
  } catch (error) {
    console.error(`SQL Error on getFactionsOfUser: ${error.message}`);
  }
  return { factions, activeFactionRole };
}

/**
 * set one bit in flags of user
 * @param uid user id
 * @param fid faction uuid (NOT sql id)
 * @param index index of flag
 * @param value 0 or 1, true or false
 * @return success boolean
 */
export async function setFlagOfUserFaction(uid, fid, index, value) {
  try {
    const mask = 0x01 << index;
    /* eslint-disable max-len */
    if (value) {
      await sequelize.query(
        'UPDATE UserFactions SET flags = flags | ? WHERE uid = ? AND fid = (SELECT id FROM Factions WHERE uuid = UUID_TO_BIN(?))', {
          replacements: [mask, uid, fid],
          raw: true,
          type: QueryTypes.UPDATE,
        },
      );
    } else {
      await sequelize.query(
        'UPDATE UserFactions SET flags = flags & ~(?) WHERE uid = ? AND fid = (SELECT id FROM Factions WHERE uuid = UUID_TO_BIN(?))', {
          replacements: [mask, uid, fid],
          raw: true,
          type: QueryTypes.UPDATE,
        },
      );
    }
    /* eslint-enable max-len */
    return true;
  } catch (error) {
    console.error(`SQL Error on setFlagOfUserFaction: ${error.message}`);
  }
  return false;
}

/**
 * set one bit in flags of faction
 * @param uid user id
 * @param fid faction uuid (NOT sql id)
 * @param index index of flag
 * @param value 0 or 1, true or false
 * @return success boolean
 */
export async function setFlagOfFaction(uid, fid, index, value) {
  try {
    const mask = 0x01 << index;
    if (value) {
      await sequelize.query(
        'UPDATE Factions SET flags = flags | ? WHERE uuid = UUID_TO_BIN(?)', {
          replacements: [mask, uid, fid],
          raw: true,
          type: QueryTypes.UPDATE,
        },
      );
    } else {
      await sequelize.query(
        // eslint-disable-next-line max-len
        'UPDATE Factions SET flags = flags & ~(?) WHERE uuid = UUID_TO_BIN(?)', {
          replacements: [mask, uid, fid],
          raw: true,
          type: QueryTypes.UPDATE,
        },
      );
    }
    return true;
  } catch (error) {
    console.error(`SQL Error on setFlagOfFaction: ${error.message}`);
  }
  return false;
}

/**
 * get powerlevel and faction sql id of user in faction
 * @param uid user id
 * @param fid faction uuid (NOT sql id)
 * @return { sqlFid | null, powerlvl | null }
 */
export async function getFactionLvlOfUser(uid, fid) {
  let sqlFid = null;
  let powerlvl = 0;
  try {
    const model = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT f.id AS sqlFid, fr.factionlvl AS powerlvl FROM Factions f
  INNER JOIN FactionRoles fr ON fr.fid = f.id
  INNER JOIN UserFactionRoles ufr ON ufr.frid = fr.id
WHERE ufr.uid = ? AND f.uuid = UUID_TO_BIN(?) ORDER BY fr.factionlvl DESC LIMIT 1`, {
      /* eslint-enable max-len */
        replacements: [uid, fid],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    if (model) {
      ({ sqlFid, powerlvl } = model);
    }
  } catch (error) {
    console.error(`SQL Error on getFactionLvlOfUser: ${error.message}`);
  }
  return { sqlFid, powerlvl };
}

/**
 * get amount of factions by user, total and owned
 * @param uid user id
 * @return [amount, amountOwned]
 */
export async function getFactionsAmountOfUser(uid, fid) {
  try {
    const model = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT COUNT(*) AS total,
  COUNT(CASE WHEN isOwner = TRUE THEN 1 END) AS owned
FROM (
  SELECT EXISTS(
    SELECT 1 FROM UserFactionRoles ufr
      INNER JOIN FactionRoles fr ON ufr.frid = fr.id
    WHERE ufr.uid = uf.uid AND fr.fid = uf.fid AND fr.factionlvl >= ${FACTIONLVL.SOVEREIGN}
  ) AS isOwner
  FROM UserFactions uf WHERE uf.uid = ?
) AS ufc`, {
        /* eslint-enable max-len */
        replacements: [uid, fid],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    if (model) {
      return [model.total, model.owned];
    }
  } catch (error) {
    console.error(`SQL Error on getFactionsAmountOfUser: ${error.message}`);
  }
  return [MAX_FACTIONS_PER_USER, MAX_OWNED_FACTIONS_PER_USER];
}

/**
 * get all members of a faction
 * @param sqlFid sql id of faction
 * @return [ userId1, userId2, ...]
 */
export async function getAllMembersOfFaction(sqlFid) {
  try {
    const models = await sequelize.query(
      'SELECT uid FROM UserFactions WHERE fid = ?', {
        replacements: [sqlFid],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    if (models) {
      return models.map(({ uid }) => uid);
    }
  } catch (error) {
    console.error(`SQL Error on getAllMembersOfFaction: ${error.message}`);
  }
  return [];
}

/**
 * check if a faction with a given name exists
 * @param name
 * @return boolean
 */
export async function checkIfFactionExists(name) {
  try {
    const model = await sequelize.query(
      'SELECT 1 FROM Factions WHERE name = ?', {
        replacements: [name],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    if (!model) {
      return false;
    }
  } catch (error) {
    console.error(`SQL Error on checkIfFactionExists: ${error.message}`);
  }
  return true;
}

/**
 * set avatar of faction
 * @param sqlFid sql id of faction
 * @param mediaId shortId:extension of media
 */
export async function setFactionAvatar(sqlFid, mediaId = null) {
  if (!mediaId) {
    return false;
  }
  try {
    const [shortId, extension] = mediaId.split(':');
    if (!shortId || !extension) {
      return false;
    }
    await sequelize.query(
      // eslint-disable-next-line max-len
      'UPDATE Factions f INNER JOIN Media m on m.shortId = ? AND m.extension = ? SET f.avatar = m.id WHERE f.id = ?', {
        replacements: [shortId, extension, sqlFid],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    return true;
  } catch (error) {
    console.error('SQL Error on setFactionAvatar:', error.message);
    return false;
  }
}

/**
 * create a new faction
 * @param uid user id of owner
 * @return factionObject | null
 */
export async function createFaction(
  uid, name, title, description, isPrivate, isPublic, avatarId,
) {
  try {
    const transaction = await sequelize.transaction();

    let flags = 0;
    if (isPrivate) {
      flags |= 0x01 << FACTION_FLAGS.PRIV;
    }
    if (isPublic) {
      flags |= 0x01 << FACTION_FLAGS.PUBLIC;
    }

    try {
      const [shortId, extension] = avatarId.split(':');
      if (!shortId || !extension) {
        return false;
      }
      /* eslint-disable max-len */
      const mediaModel = await sequelize.query(
        'SELECT id AS mediaSqlId FROM Media m WHERE m.shortId = ? AND m.extension = ?', {
          replacements: [shortId, extension],
          plain: true,
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      if (!mediaModel) {
        throw new Error('Media not found');
      }
      const { mediaSqlId } = mediaModel;

      /*
       * creat faction chat channel
       */
      await sequelize.query(
        'INSERT INTO Channels (name, type, lastMessage, createdAt) VALUES (?, ?, NOW(), NOW())', {
          replacements: [name, CHANNEL_TYPES.FACTION],
          raw: true,
          type: QueryTypes.INSERT,
          transaction,
        },
      );

      /*
       * create faction
       */
      const fid = bufferToUUID(generateUUID());
      await sequelize.query(
        'INSERT INTO Factions (uuid, name, title, description, avatar, flags, createdAt, cid) SELECT UUID_TO_BIN(?), ?, ?, ?, ?, ?, NOW(), c.id FROM Channels c WHERE c.name = ? AND c.type = ?', {
          replacements: [
            fid, name, title, description,
            mediaSqlId, flags, name, CHANNEL_TYPES.FACTION,
          ],
          raw: true,
          type: QueryTypes.INSERT,
          transaction,
        },
      );
      /*
       * create default roles
       */
      const sovereignFrid = bufferToUUID(generateUUID());
      const peasantFrid = bufferToUUID(generateUUID());
      await sequelize.query(
        `INSERT INTO FactionRoles (uuid, fid, name, factionlvl)
  SELECT roles.uuid, f.id AS fid, roles.name, roles.factionlvl FROM Factions f
    CROSS JOIN (
      SELECT UUID_TO_BIN(?) AS uuid, 'Sovereign' AS name, ? AS factionlvl
      UNION ALL
      SELECT UUID_TO_BIN(?) AS uuid, 'Peasant' AS name, ? AS factionlvl
    ) AS roles
  WHERE f.name = ?`, {
          replacements: [
            sovereignFrid, FACTIONLVL.SOVEREIGN,
            peasantFrid, FACTIONLVL.PEASANT,
            name,
          ],
          raw: true,
          type: QueryTypes.INSERT,
          transaction,
        },
      );
      /*
       * add user to faction and give him the sovereign role
       */
      await Promise.all([
        sequelize.query(
          'INSERT INTO UserFactions (uid, fid, joined) SELECT ?, fr.id, NOW() FROM Factions f WHERE f.name = ?', {
            replacements: [uid, name],
            raw: true,
            type: QueryTypes.INSERT,
            transaction,
          },
        ),
        sequelize.query(
          'INSERT INTO UserFactionRoles (uid, frid) SELECT ?, fr.id FROM FactionRoles fr WHERE fr.uuid = UUID_TO_BIN(?)', {
            replacements: [uid, sovereignFrid],
            raw: true,
            type: QueryTypes.INSERT,
            transaction,
          },
        ),
      ]);
      /* eslint-enable max-len */
      await transaction.commit();
      return {
        fid,
        name,
        title,
        description,
        isPrivate,
        isPublic,
        isHidden: false,
        avatarId,
        roles: [{
          frid: sovereignFrid,
          name: 'Sovereign',
          customFlagId: null,
          factionlvl: FACTIONLVL.SOVEREIGN,
          isMember: true,
        }, {
          frid: sovereignFrid,
          name: 'Peasant',
          customFlagId: null,
          factionlvl: FACTIONLVL.PEASANT,
          isMember: false,
        }],
      };
    } catch (error) {
      if (transaction && !transaction.finished) {
        await transaction.rollback();
      }
      throw error;
    }
  } catch (error) {
    console.error('SQL Error on createFaction:', error.message);
  }
  return null;
}

/**
 * delete faction
 * @param sqlFid sql faction id
 * @return [userId1, userId2, ...] affected users
 */
export async function deleteFaction(sqlFid) {
  try {
    const affectedUsers = await getAllMembersOfFaction();
    /*
     * faction channel deletion should cascade to everything related, since
     * faction depends on it
     */
    await sequelize.query(
      // eslint-disable-next-line max-len
      'DELETE FROM Channels WHERE id = (SELECT f.cid FROM Factions f WHERE f.id = ?)', {
        replacements: [sqlFid],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    return affectedUsers;
  } catch (error) {
    console.error('SQL Error on deleteFaction:', error.message);
  }
  return [];
}

/**
 * change a property of a faction
 * @param sqlFid sql id of faction
 * @param property
 * @param value
 * @return success
 */
export async function setFactionProperty(sqlFid, property, value) {
  try {
    await sequelize.query(
      `UPDATE Factions SET ${property} = ? WHERE id = ?`, {
        replacements: [value, sqlFid],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on setFactionProperty: ${error.message}`);
  }
  return false;
}

export default Faction;
