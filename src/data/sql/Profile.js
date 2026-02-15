import { QueryTypes, DataTypes } from 'sequelize';

import sequelize from './sequelize.js';

const Profile = sequelize.define('Profile', {
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },

  customFlag: {
    type: DataTypes.STRING(2),
    allowNull: true,
  },
});

/**
 * set custom flag of a user
 * @param uid userId
 * @param code two letter flag code
 */
export async function setCustomFlag(uid, code = null) {
  try {
    if (!uid) {
      return false;
    }
    await sequelize.query(
      // eslint-disable-next-line max-len
      'INSERT INTO Profiles (uid, customFlag) VALUES (?, ?) ON DUPLICATE KEY UPDATE customFlag = VALUES(customFlag)', {
        replacements: [uid, code],
        raw: true,
        type: QueryTypes.INSERT,
      },
    );
    return true;
  } catch (err) {
    console.error('SQL Error on createCustomFlag:', err.message);
    return false;
  }
}

/**
 * get custom flag of user
 * @param uid user id
 * @return two letter flag code or null
 */
export async function getCustomFlagById(uid) {
  try {
    const flag = await sequelize.query(
      'SELECT code FROM CustomFlags WHERE uid = $1', {
        bind: [uid],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    return flag?.code;
  } catch (error) {
    console.error(`SQL Error on getCustomFlagById: ${error.message}`);
  }
  return null;
}

export default Profile;
