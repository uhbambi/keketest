/**
 *
 * Storing third party IDs for oauth login
 */

import Sequelize, { DataTypes } from 'sequelize';

import sequelize from './sequelize';
import ThreePIDHistory from './ThreePIDHistory';

import { THREEPID_PROVIDERS } from '../../core/constants';
export { THREEPID_PROVIDERS };

const ThreePID = sequelize.define('ThreePID', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
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
    // eslint-disable-next-line max-len
    type: 'VARCHAR(80) GENERATED ALWAYS AS (NORMALIZE_TPID(provider, tpid)) STORED',
    set() {
      throw new Error('Do not try to set normalizedTpid. It is generated');
    },
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
    fields: ['provider', 'tpid'],
  }, {
    unique: true,
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
    const existingEmail = await ThreePID.findOne({
      where: {
        provider: THREEPID_PROVIDERS.EMAIL,
        normalizedTpid: Sequelize.fn(
          'NORMALIZE_TPID', THREEPID_PROVIDERS.EMAIL, email,
        ),
      },
      raw: true,
    });
    if (existingEmail?.uid !== uid) {
      return null;
    }

    const transaction = await sequelize.transaction();

    try {
      if (existingEmail) {
        await Promise.all([
          ThreePIDHistory.create({
            uid: existingEmail.uid,
            provider: THREEPID_PROVIDERS.EMAIL,
            tpid: existingEmail.email,
            verified: existingEmail.verified,
            createdAt: existingEmail.createdAt,
          }), { transaction },
          ThreePID.destroy({
            where: { id: existingEmail.id },
            transaction,
          }),
        ]);
      }

      await ThreePID.create({
        uid,
        provider: THREEPID_PROVIDERS.EMAIL,
        tpid: email,
        verified: verified,
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
