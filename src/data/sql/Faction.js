/*
 * factions
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize, { nestQuery } from './sequelize.js';
import { FACTION_FLAGS } from '../../core/constants.js';

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
    allowNll: false,
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
 * @return [{
 *   id,
 *   name,
 *   title,
 *   description,
 *   isPrivate,
 *   isPublic,
 *   avatarId,
 *   roles: [{
 *     name,
 *     customFlagId,
 *     factionlvl,
 *     isMember,
 *   }, ...],
 * }, ...]
 */
export async function getFactionsOfUser(uid) {
  try {
    let models = await sequelize.query(
      `SELECT BIN_TO_UUID(f.uuid) AS id, f.name, f.title, f.description, f.flags,
CONCAT(a.shortId, ':', a.extension) AS avatarId,
CONCAT(frm.shortId, ':', frm.extension) AS 'roles.customFlagId',
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
    );
    if (models) {
      models = nestQuery(models);
      for (let i = 0; i < models.length; i += 1) {
        const model = models[i];
        model.isPrivate = (model.flags & (0x01 << FACTION_FLAGS.PRIV)) !== 0;
        model.isPublic = (model.flags & (0x01 << FACTION_FLAGS.PUBLIC)) !== 0;
        delete model.flags;
      }
      return models;
    }
  } catch (error) {
    console.error(`SQL Error on deleteAllDMChannelsOfUser: ${error.message}`);
  }
  return [];
}

export default Faction;
