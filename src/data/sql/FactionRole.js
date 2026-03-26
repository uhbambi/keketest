/*
 * Custom Roles of factions, those are like roles that the user can choose
 * from
 */

import { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import { generateUUID, bufferToUUID } from '../../utils/hash.js';
import { FACTIONLVL } from '../../core/constants.js';

const FactionRole = sequelize.define('FactionRole', {
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

  fid: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: false,
  },

  /*
   * if null, users with this action role will show their geo flags or
   * choose their own
   */
  customFlag: {
    type: DataTypes.BIGINT.UNSIGNED,
    allowNull: true,
  },

  name: {
    // eslint-disable-next-line max-len
    type: `${DataTypes.STRING(32)} CHARACTER SET ascii COLLATE ascii_general_ci`,
    allowNull: false,
  },

  /*
   * what user with role is allowed to do
   */
  factionlvl: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: FACTIONLVL.PEASANT,
  },

  memberCount: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
}, {
  indexes: [{
    name: 'role_fid',
    fields: ['fid'],
  }],
});


/**
 * get powerlevel and faction and role sql id of user in faction based on role
 * @param frid faction role uuid (NOT sql id)
 * @return { fid | null, sqlFrid | null, factionlvl | null }
 */
export async function getFactionRole(frid) {
  let fid = null;
  let sqlFrid = null;
  let factionlvl = 0;
  try {
    const model = await sequelize.query(
      // eslint-disable-next-line max-len
      `SELECT BIN_TO_UUID(f.uuid) AS fid, fr.id AS sqlFrid, fr.factionlvl FROM FactionRoles fr
  INNER JOIN Factions f ON fr.fid = f.id
WHERE fr.uuid = UUID_TO_BIN(?)`, {
        replacements: [frid],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    if (model) {
      ({ fid, sqlFrid, factionlvl } = model);
    }
  } catch (error) {
    console.error(`SQL Error on getFactionRole: ${error.message}`);
  }
  return { fid, sqlFrid, factionlvl };
}

/**
 * set custom flag for faction role
 * @param sqlFrid sql id of faction role
 * @param mediaId shortId:extension of media
 */
export async function setFactionRoleFlag(sqlFrid, mediaId = null) {
  try {
    if (!mediaId) {
      await sequelize.query(
        'UPDATE FactionRoles SET customFlag = NULL WHERE id = ?', {
          replacements: [sqlFrid],
          raw: true,
          type: QueryTypes.UPDATE,
        },
      );
      return true;
    }

    const [shortId, extension] = mediaId.split(':');
    if (!shortId || !extension) {
      return false;
    }
    await sequelize.query(
      // eslint-disable-next-line max-len
      'UPDATE FactionRoles INNER JOIN Media m on m.shortId = ? AND m.extension = ? SET customFlag = m.id WHERE FactionRoles.id = ?', {
        replacements: [shortId, extension, sqlFrid],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    return true;
  } catch (err) {
    console.error('SQL Error on setUserAvatar:', err.message);
    return false;
  }
}

/**
 * change a property of a faction role
 * @param sqlFrid sql id of faction role
 * @param property
 * @param value
 * @return success
 */
export async function setFactionRoleProperty(sqlFrid, property, value) {
  try {
    await sequelize.query(
      `UPDATE FactionRoles SET ${property} = ? WHERE id = ?`, {
        replacements: [value, sqlFrid],
        raw: true,
        type: QueryTypes.UPDATE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on setFactionRoleProperty: ${error.message}`);
  }
  return false;
}


/**
 * create a new faction role
 * @param fid uuid of faction
 * @return [number, frid]
 *   0 success
 *   1 faction doesn't exist
 *   2 customFlagId invalid
 *   3 failure
 */
export async function createFactionRole(
  fid, name, factionlvl, customFlagId,
) {
  try {
    const frid = bufferToUUID(generateUUID());

    const model = await sequelize.query(
      'CALL CREATE_FACTION_ROLE(?, ?, ?, ?, ?)', {
        replacements: [
          fid, frid, name, factionlvl, customFlagId,
        ],
        plain: true,
        type: QueryTypes.SELECT,
      },
    );
    const ret = model?.[0]?.result;
    if (ret || ret === 0) {
      return [ret, ret === 0 ? fid : null];
    }
  } catch (error) {
    console.error('SQL Error on createFactionRole:', error.message);
  }
  return [3, null];
}

export default FactionRole;
