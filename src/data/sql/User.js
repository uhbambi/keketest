/**
 *
 * This is the database of the data for registered Users
 *
 */

import { randomUUID } from 'crypto';
import Sequelize, { DataTypes, QueryTypes, Op } from 'sequelize';

import sequelize from './sequelize';
import { generateHash } from '../../utils/hash';
import UserIP from './UserIP';
import { USERLVL, THREEPID_PROVIDERS } from '../../core/constants';
import { CHANNEL_TYPES } from './Channel';
export { USERLVL, THREEPID_PROVIDERS } from '../../core/constants';


const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  // STRING is VARCHAR, CHAR is CHAR
  name: {
    type: DataTypes.STRING(32),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
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
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: USERLVL.REGISTERED,
  },

  /*
   * from lowest to highest bit:
   * 0: blockDm (if account blocks all DMs)
   * 1: priv (if account is private)
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
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

  /*
   * virtual
   */

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
});

/*
 * includes for user used in requests
 */
export const loginInclude = [{
  association: 'channels',
  where: {
    type: {
      [Op.not]: CHANNEL_TYPES.DM,
    },
  },
}, {
  association: 'dms',
  where: {
    type: CHANNEL_TYPES.DM,
  },
  include: [{
    association: 'users',
    attributes: ['id', 'name'],
  }],
}, {
  association: 'blocked',
  attributes: ['id', 'name'],
}, {
  association: 'tpids',
}];

/**
 * update lastSeen timestamps of User
 * @param id user id
 * @param ipString ip as string
 */
export async function touchUser(id, ipString) {
  try {
    await User.update({ lastSeen: Sequelize.fn('NOW') }, {
      where: { id },
    })
    await UserIP.upsert({
      uid: id,
      ip: Sequelize.fn('IP_TO_BIN', ipString),
    });
  } catch (error) {
    console.error(`SQL Error on touchUser: ${error.message}`);
  }
}

export async function name2Id(name) {
  try {
    const userq = await sequelize.query(
      'SELECT id FROM Users WHERE name = ?',
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

export async function id2Name(id) {
  const user = await User.findByPk(id, {
    attributes: ['name'],
    raw: true,
  });
  if (user) {
    return user.name;
  }
  return null;
}

export async function findIdByNameOrId(searchString) {
  let id;
  if (!Number.isNaN(Number(searchString))) {
    id = parseInt(searchString, 10);
    const name = await id2Name(id);
    if (name) {
      return { name, id };
    }
  }

  id = await name2Id(searchString);
  if (id) {
    return { name: searchString, id };
  }
  return null;
}

export async function getNamesToIds(ids) {
  const idToNameMap = new Map();
  if (!ids.length || ids.length > 300) {
    return idToNameMap;
  }
  try {
    const result = await User.findAll({
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
 * get user by id
 * @param id
 * @return user object or null if not found
 */
export async function findUserById(id) {
  if (!id) {
    return null;
  }
  try {
    return await User.findByPk(id, { include: loginInclude });
  } catch (err) {
    console.error(`SQL Error on findUserById: ${err.message}`);
    return null;
  }
}

/*
 * get User by email
 * @param email
 * @param populate
 * @return user object or null if not found (limited if populate is unset)
 */
export function getUserByEmail(email, populate) {
  return getUserByTpid(THREEPID_PROVIDERS.EMAIL, email, populate);
}

/*
 * get User by tpid
 * @param provider
 * @param tpid
 * @param populate
 * @return user object or null if not found (limited if populate is unset)
 */
export async function getUserByTpid(provider, tpid, populate) {
  if (!tpid || !provider) {
    return null;
  }
  try {
    if (populate) {
      return await User.findOne({
        include: [
          ...loginInclude.filter((i) => i.association !== 'tpids'), {
            association: 'tpids',
            where: {
              provider,
              tpid,
            },
            right: true,
          },
        ],
      });
    }
    return await User.findOne({
      include: {
        association: 'tpids',
        where: {
          provider,
          tpid,
        },
        right: true,
      },
      raw: true,
    });
  } catch (err) {
    console.error(`SQL Error on getUserByEmail: ${err.message}`);
    return null;
  }
}

/*
 * check if name is taken and if it is,
 * modify it till we find a name that is available
 * @param name
 * @return unique name
 */
export async function getNameThatIsNotTaken(name) {
  let limit = 5;
  let user = await User.findOne({
    attributes: [ 'id' ],
    where: { name },
    raw: true,
  });
  while (user) {
    limit -= 1;
    if (!limit) {
      return randomUUID().split('-').join('');
    }
    // eslint-disable-next-line max-len
    name = `${name.substring(0, 15)}-${Math.random().toString(36).substring(2, 10)}`;
    // eslint-disable-next-line no-await-in-loop
    user = await User.findOne({
      attributes: [ 'id' ],
      where: { name },
      raw: true,
    });
  }
  return name;
}

/*
 * verify a users email
 * @param email
 * @return name if successful, otherwise false
 */
export async function verifyEmail(email) {
  if (!email) {
    return false;
  }
  try {
    const user = await User.findOne({
      include: {
        association: 'tpids',
        where: {
          provider: THREEPID_PROVIDERS.EMAIL,
          tpid: email,
        },
      },
    });
    if (!user) {
      return false;
    }
    const promises = [
      user.tpids.find(
        (t) => (t.provider === THREEPID_PROVIDERS.EMAIL && t.tpid === email),
      ).update({ verified: true }),
    ];
    if (user.userlvl === USERLVL.REGISTERED) {
      promises.push(user.update({ userlvl: USERLVL.VERIFIED }));
    }
    await Promise.all(promises);
    return user.name;
  } catch (err) {
    console.error(`SQL Error on verifyEmail: ${err.message}`);
    return false;
  }
}

/*
 * get Users by name or email
 * @param name (or either name or email if email not given)
 * @param email (optional)
 * @param populate boolean
 * @return array of user objects (limited if populate is unset)
 */
export async function getUsersByNameOrEmail(name, email, populate) {
  if (!name) {
    return [];
  }
  if (!email) {
    email = name;
  }
  try {
    if (populate) {
      return await User.findAll({
        where: {
          [Op.or]: [{
            name
          }, {
            '$tpids.provider$': THREEPID_PROVIDERS.EMAIL,
            '$tpids.tpid$': email,
          }],
        },
        include: [
          ...loginInclude.filter((i) => i.association !== 'tpids'), {
            association: 'tpids',
            right: true,
          },
        ],
      });
    }
    return await User.findAll({
      where: {
        [Op.or]: [{
          name
        }, {
          [Sequelize.col('tpids.provider')]: THREEPID_PROVIDERS.EMAIL,
          [Sequelize.col('tpids.tpid')]: email,
        }],
      },
      include: {
        association: 'tpids',
        right: true,
      },
      raw: true,
      nested: true,
    });
  } catch (err) {
    console.error(`SQL Error on getUsersByNameOrEmail: ${err.message}`);
    return [];
  }
}

/**
 * create new User
 * @param name
 * @param [password]
 * @param [tpid] object with { provider, tpid, verified }
 * @return user object or null if not successful
 */
export async function createNewUser(name, password, tpid) {
  const query = { name };
  if (password) query.password = password;
  if (tpid) query.tpids = [tpid];
  try {
    return await User.create(query, {
      include: loginInclude,
    });
  } catch (err) {
    console.error(`SQL Error on createNewUser: ${err.message}`);
    return null;
  }
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
  const userData = await User.findAll({
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

export default User;
