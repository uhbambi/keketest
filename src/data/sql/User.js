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
  association: 'bans',
  attributes: [],
  limit: 1,
}, {
  association: 'tpids',
  include: [{
    association: 'bans',
  }],
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
    if (ipString) {
      await UserIP.upsert({
        uid: id,
        ip: Sequelize.fn('IP_TO_BIN', ipString),
        lastSeen: Sequelize.fn('NOW'),
      });
    }
  } catch (error) {
    console.error(`SQL Error on touchUser: ${error.message}`);
  }
}

/**
 * find or create a dummmy user. This is used for bot users.
 * @param name name of user
 */
export async function getDummyUser(name) {
  const dummy = await User.findOrCreate({
    attributes: [ 'id' ],
    where: { name },
    defaults: {
      name,
      userlvl: USERLVL.VERIFIED,
    },
    raw: true,
  });
  return dummy[0].id;
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

/**
 * get User by id
 * @param id
 * @return [{ id, name, password, userlvl }, ... ]
 */
export async function findUserById(id) {
  if (!id) {
    return null;
  }
  try {
    return await User.findByPk(id, {
      attributes: [ 'id', 'name', 'password', 'userlvl' ],
      raw: true,
    });
  } catch (err) {
    console.error(`SQL Error on findUserById: ${err.message}`);
    return null;
  }
}

/**
 * get User by email
 * @param email
 * @return limited user object or null if not found
 */
export function getUserByEmail(email) {
  return getUserByTpid(THREEPID_PROVIDERS.EMAIL, email)
}

/**
 * get User by tpid
 * @param provider
 * @param tpid
 * @return limited user object or null if not found
 */
export async function getUserByTpid(provider, tpid) {
  if (!tpid || !provider) {
    return null;
  }
  try {
    return await User.findOne({
      attributes: ['id', 'name', 'password', 'userlvl'],
      include: {
        association: 'tpids',
        where: {
          provider,
          [Op.or]: [
            { tpid },
            {
              [Op.not]: { normalizedTpid: null },
              normalizedTpid: Sequelize.fn('NORMALIZE_TPID', provider, tpid),
            },
          ],
        },
        required: true,
      },
      raw: true,
      nested: true,
    });
  } catch (error) {
    console.error(`SQL Error on getUserByTpid: ${error.message}`);
  }
  return null;
}

/**
 * set password of user
 * @param id user id
 * @param password (in clear text, we hash it here)
 * @return boolean if successful
 */
export async function setPasswordOfUser(id, password) {
  try {
    const [rows] = await User.update({ password }, {
      where: { id },
    });
    return rows > 0;
  } catch (error) {
    console.error(`SQL Error on getUserByTpid: ${error.message}`);
  }
  return false;
}

/**
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

/**
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
        required: true,
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
      user.tpids[0].update({ verified: true }),
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

/**
 * get Users by name or email
 * @param name (or either name or email if email not given)
 * @param email (optional)
 * @param populate boolean
 * @return [{ id, name, password, userlvl, byEmail }, ... ] | null on error
 */
export async function getUsersByNameOrEmail(name, email) {
  if (!name) {
    return [];
  }
  if (!email) {
    email = name;
  }
  try {
    return await User.findAll({
      attributes: [ 'id', 'name', 'password', 'userlvl', [
        Sequelize.literal('tpids.tpid IS NOT NULL'), 'byEMail',
      ]],
      where: {
        [Op.or]: [{ name }, {
          [Sequelize.col('tpids.provider')]: THREEPID_PROVIDERS.EMAIL,
          [Sequelize.col('tpids.tpid')]: email,
        }],
      },
      include: {
        association: 'tpids',
        attributes: [],
      },
      raw: true,
    });
  } catch (err) {
    console.error(`SQL Error on getUsersByNameOrEmail: ${err.message}`);
    return null;
  }
}

/**
 * create new User
 * @param name
 * @param [password]
 * @return limited user object or null if not successful
 */
export async function createNewUser(name, password) {
  const query = { name };
  if (password) query.password = password;
  try {
    return await User.create(query, { raw: true } );
  } catch (error) {
    console.error(`SQL Error on createNewUser: ${error.message}`);
    return null;
  }
}

/**
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
