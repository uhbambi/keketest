/*
 * factions
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize, { nestQuery } from './sequelize.js';
import { FACTION_FLAGS, USER_FACTION_FLAGS } from '../../core/constants.js';

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
    type: `${DataTypes.STRING(250)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
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
        'UPDATE Users SET flags = flags & ~(?) WHERE uid = ? AND fid = (SELECT id FROM Factions WHERE uuid = UUID_TO_BIN(?))', {
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

export default Faction;
