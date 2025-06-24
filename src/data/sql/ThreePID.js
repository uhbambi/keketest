/**
 *
 * Storing third party IDs for oauth login
 */

import Sequelize, { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize.js';
import ThreePIDHistory from './ThreePIDHistory.js';

import { THREEPID_PROVIDERS } from '../../core/constants.js';

export { THREEPID_PROVIDERS };

const ThreePID = sequelize.define('ThreePID', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  provider: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  tpid: {
    type: DataTypes.STRING(80),
    allowNull: false,
  },

  normalizedTpid: {
    /*
     * this is NORMALIZE_TPID function inlined, which removes . and +string
     * from emails.
     * We can't use the function itself, cause generated columns do not allow
     * that.
     */
    // eslint-disable-next-line max-len
    type: 'VARCHAR(80) GENERATED ALWAYS AS (CASE WHEN provider != 1 THEN NULL WHEN LOCATE(\'@\', tpid) = 0 THEN NULL ELSE LOWER(CONCAT(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(tpid, \'@\', 1), \'+\', 1), \'.\', \'\'),\'@\',(SUBSTRING_INDEX(tpid, \'@\', -1)))) END) STORED',
  },

  verified: {
    type: DataTypes.BOOLEAN,
  },

  lastSeen: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [{
    unique: true,
    name: 'ptpid',
    fields: ['provider', 'tpid'],
  }, {
    unique: true,
    name: 'pntpid',
    fields: ['provider', 'normalizedTpid'],
  }],
});

/**
 * upsert a tpid
 * @param uid user id
 * @param provider THREEPID_PROVIDERS
 * @param tpid threepid string
 * @param verified whether or not verified (should only be used for emaill
 */
export async function addOrReplaceTpid(uid, provider, tpid, verified = null) {
  try {
    const query = { uid, provider, tpid, lastSeen: Date.now() };
    if (verified) query.verified = true;

    await ThreePID.upsert(query, { returning: false });
  } catch (error) {
    console.error(`SQL Error on addOrReplaceTpid: ${error.message}`);
    return false;
  }
  return true;
}

export async function getEmailOfUser(uid) {
  try {
    const tpid = await ThreePID.findOne({
      attributes: ['tpid'],
      where: {
        uid,
        provider: THREEPID_PROVIDERS.EMAIL,
      },
      raw: true,
    });
    if (tpid) {
      return tpid.tpid;
    }
  } catch (error) {
    console.error(`SQL Error on getEmailOfUser: ${error.message}`);
  }
  return null;
}

/**
 * get all ThreePIDs of user
 * @param uid user id
 * @return Promise<[{
 *   tpid, normalizedTpid, provider, verified, lastSeen, createdAt },
 *   ...
 * ]>
 */
export function getTPIDsOfUser(uid) {
  return sequelize.query(
    'SELECT * FROM ThreePIDs WHERE uid = ?', {
      replacements: [uid],
      raw: true,
      type: QueryTypes.SELECT,
    },
  );
}

/**
 * set email of user
 * @param uid user id
 * @param email email string
 * @param verified whether or not the email got verified
 * @param return boolean if email got set, null if email already exists for
 *   different user
 */
export async function setEmail(uid, email, verified = false) {
  try {
    const [existingEmail, existingUserEmail] = await Promise.all([
      ThreePID.findOne({
        attributes: ['uid'],
        where: {
          provider: THREEPID_PROVIDERS.EMAIL,
          normalizedTpid: Sequelize.fn(
            'NORMALIZE_TPID', THREEPID_PROVIDERS.EMAIL, email,
          ),
        },
        raw: true,
      }),
      ThreePID.findOne({
        where: {
          uid,
          provider: THREEPID_PROVIDERS.EMAIL,
        },
        raw: true,
      }),
    ]);
    if (existingEmail) {
      return null;
    }

    const transaction = await sequelize.transaction();

    try {
      if (existingUserEmail) {
        await Promise.all([
          ThreePIDHistory.create({
            uid: existingUserEmail.uid,
            provider: THREEPID_PROVIDERS.EMAIL,
            tpid: existingUserEmail.tpid,
            verified: existingUserEmail.verified,
            createdAt: existingUserEmail.createdAt,
          }), { transaction },
          ThreePID.destroy({
            where: { id: existingUserEmail.id },
            transaction,
          }),
        ]);
      }

      await ThreePID.create({
        uid,
        provider: THREEPID_PROVIDERS.EMAIL,
        tpid: email,
        verified,
      }, { transaction });

      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`SQL Error on setEmail: ${error.message}`);
    return false;
  }
  return true;
}

export default ThreePID;
