/**
 *
 * This is the database of the data for registered Users
 *
 */

import Sequelize, { DataTypes, QueryTypes } from 'sequelize';

import sequelize from './sequelize';
import { generateHash } from '../../utils/hash';
import { USERLVL } from '../../core/constants';

export { USERLVL } from '../../core/constants';


const RegUser = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  name: {
    type: `${DataTypes.CHAR(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    unique: true,
  },

  // null if only ever used external oauth
  password: {
    type: DataTypes.CHAR(60),
    set(value) {
      if (value) this.setDataValue('password', generateHash(value));
    },
  },

  userlvl: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: USERLVL.REGISTERED,
  },

  /*
   * from lowest to highest bit:
   * 0: blockDm (if account blocks all DMs)
   * 1: priv (if account is private)
   */
  flags: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },

  /*
   * when email verification got requested,
   * NULL means successfully verified
   */
  verificationReqAt: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  blockDm: {
    type: DataTypes.VIRTUAL,
    get() {
      return !!(this.flags & 0x01);
    },
    set(num) {
      const val = (num) ? (this.flags | 0x01) : (this.flags & ~0x01);
      this.setDataValue('flags', val);
    },
  },

  priv: {
    type: DataTypes.VIRTUAL,
    get() {
      return !!(this.flags & 0x02);
    },
    set(num) {
      const val = (num) ? (this.flags | 0x02) : (this.flags & ~0x02);
      this.setDataValue('flags', val);
    },
  },

  verified: {
    type: DataTypes.VIRTUAL,
    get() {
      return (this.verificationReqAt === null);
    },
    set(value) {
      if (value) {
        this.setDataValue('verificationReqAt', null);
      } else {
        this.setDataValue('verificationReqAt', new Date());
      }
    },
  },
});

export async function name2Id(name) {
  try {
    const userq = await sequelize.query(
      'SELECT id FROM Users WHERE name = $1',
      {
        bind: [name],
        type: QueryTypes.SELECT,
        raw: true,
        plain: true,
      },
    );
    return userq.id;
  } catch {
    return null;
  }
}

export async function findIdByNameOrId(searchString) {
  let id = await name2Id(searchString);
  if (id) {
    return { name: searchString, id };
  }
  id = parseInt(searchString, 10);
  if (!Number.isNaN(id)) {
    const user = await RegUser.findByPk(id, {
      attributes: ['name'],
      raw: true,
    });
    if (user) {
      return { name: user.name, id };
    }
  }
  return null;
}

export async function getNamesToIds(ids) {
  const idToNameMap = new Map();
  if (!ids.length || ids.length > 300) {
    return idToNameMap;
  }
  try {
    const result = await RegUser.findAll({
      attributes: ['id', 'name'],
      where: {
        id: ids,
      },
      raw: true,
    });
    result.forEach((obj) => {
      idToNameMap.set(obj.id, obj.name);
    });
  } catch {
    // nothing
  }
  return idToNameMap;
}

/*
 * take array of objects that include user ids and add
 * user informations if user is not private
 * @param rawRanks array of {id: userId, ...} objects
 */
export async function populateIdObj(rawRanks) {
  if (!rawRanks.length) {
    return rawRanks;
  }
  const uids = rawRanks.map((r) => r.id);
  const userData = await RegUser.findAll({
    attributes: [
      'id',
      'name',
      [
        Sequelize.fn(
          'DATEDIFF',
          Sequelize.literal('CURRENT_TIMESTAMP'),
          Sequelize.col('createdAt'),
        ),
        'age',
      ],
    ],
    where: {
      id: uids,
      priv: false,
    },
    raw: true,
  });
  for (const { id, name, age } of userData) {
    const dat = rawRanks.find((r) => r.id === id);
    if (dat) {
      dat.name = name;
      dat.age = age;
    }
  }
  return rawRanks;
}

export default RegUser;
