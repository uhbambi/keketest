import Sequelize, { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize';
import { generateToken, generateTokenHash } from '../../utils/hash';
import { loginInclude } from './RegUser';
import { HOUR } from '../../cores/constants';
import { SESSION_DURATION } from '../../core/config';

const Session = sequelize.define('Session', {
  token: {
    type: DataTypes.CHAR(38),
    allowNull: false,
    unique: true,
  },

  expires: {
    type: DataTypes.DATE,
    allowNull: false,
  },
});

/**
 * create session for a user
 * @param uid id of user
 * @return null | session Model instance
 */
export async function createSession(uid) {
  try {
    const token = generateToken();
    const session = await Session.create({
      uid,
      token,
      expires: new Date(Date.now() + SESSION_DURATION * HOUR),
    }, {
      raw: true,
    });
    if (session) {
      return session;
    }
  } catch (error) {
    console.error(`SQL Error on createSession: ${error.message}`);
  }
  return null;
}

/**
 * resolve a session for a given token
 * @param token
 * @return null | user data
 */
export async function resolveSession(token) {
  if (!token) {
    return null;
  }
  try {
    const session = await Session.findOne({
      where: {
        token: generateTokenHash(token),
        expires: { [Op.lt]: Sequelize.fn('NOW') },
      },
      include: {
        association: 'user',
        include: loginInclude,
      },
    });
    if (session) {
      return session.user;
    }
  } catch (error) {
    console.error(`SQL Error on resolveSession: ${error.message}`);
  }
  return null;
}

export default Session;
