import { QueryTypes, DataTypes } from 'sequelize';

import sequelize from './sequelize.js';

const CustomFlag = sequelize.define('CustomFlag', {
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    primaryKey: true,
  },

  code: {
    type: DataTypes.STRING(2),
    allowNull: false,
  },
});

export async function createCustomFlag(uid, code) {
  try {
    const flag = await CustomFlag.findOne({ where: { uid } });
    if (flag) {
      flag.code = code;
      await flag.save();
    } else {
      await CustomFlag.create({ uid, code });
    }
    return true;
  } catch (err) {
    console.error('SQL Error on createCustomFlag:', err.message);
    return false;
  }
}

export async function deleteCustomFlag(uid) {
  try {
    await CustomFlag.destroy({
      where: { uid },
    });
    return true;
  } catch (error) {
    console.error(`SQL Error on deleteCustomFlag: ${error.message}`);
  }
  return false;
}

export async function getCustomFlagById(uid) {
  try {
    const flag = await sequelize.query(
      'SELECT uid, code FROM CustomFlags WHERE uid = $1', {
        bind: [uid],
        type: QueryTypes.SELECT,
        plain: true,
      },
    );
    if (flag) {
      return flag.code;
    }
  } catch (error) {
    console.error(`SQL Error on getCustomFlagById: ${error.message}`);
  }
  return null;
}

export default CustomFlag;
