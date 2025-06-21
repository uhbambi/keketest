import Sequelize, { DataTypes, Op } from 'sequelize';

import sequelize from './sequelize';
import { generateToken, generateTokenHash } from '../../utils/hash';
import { HOUR, THREEPID_PROVIDERS } from '../../core/constants';
import { CHANNEL_TYPES } from './Channel';

const Session = sequelize.define('Session', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  token: {
    type: DataTypes.CHAR(38),
    allowNull: false,
    unique: 'token',
  },

  expires: {
    type: DataTypes.DATE,
  },
});

/**
 * create session for a user
 * @param uid id of user
 * @param durationHours how long session is valid in hours or null for permanent
 * @return null | token session token
 */
export async function createSession(uid, durationHours) {
  if (durationHours !== null && !durationHours) {
    /*
     * if we have a duration of 0, which would be a cookie that deletes on
     * browser close, we still store it for 30 days, cause we don't know when
     * a browser closes
     */
    durationHours = 720;
  }

  try {
    /* limit the amount of open sessions a user can have */
    const openSessions = await Session.count({ where: { uid } });
    if (openSessions > 100) {
      await Session.destroy({
        where: {
          id: {
            [Op.in]: Sequelize.literal(
              // eslint-disable-next-line max-len
              '(SELECT id FROM Sessions WHERE uid = ? ORDER BY id ASC LIMIT 10)',
              { bind: [uid] },
            ),
          },
        },
      });
    }

    const token = generateToken();
    const session = await Session.create({
      uid,
      token: generateTokenHash(token),
      expires: durationHours && Date(Date.now() + durationHours * HOUR),
    }, {
      raw: true,
    });
    if (session) {
      return token;
    }
  } catch (error) {
    console.error(`SQL Error on createSession: ${error.message}`);
  }
  return null;
}

/**
 * remove session
 * @param token
 * @return boolean success
 */
export async function removeSession(token) {
  if (!token) {
    return false;
  }
  try {
    const count = await Session.destroy({
      where: { token: generateTokenHash(token) },
    });
    return count !== 0;
  } catch (error) {
    console.error(`SQL Error on removeSession: ${error.message}`);
  }
  return false;
}

/**
 * resolve a session for a given token
 * @param token
 * @return null | {
 *   id,
 *   name,
 *   password,
 *   userlvl,
 *   flags,
 *   lastSeen,
 *   createdAt,
 *   mailreg,
 *   bans: [ { expires, flags }, ... ],
 *   tpids: [ { tpid, provider }, ... ],
 *   blocked: [ { id, name }, ...],
 *   channels: {
 *     cid: [ name, type, lastTs, [dmuid] ],
 *     ...
 *   },
 * }
 */
export async function resolveSession(token) {
  if (!token) {
    return null;
  }
  try {
    const session = await Session.findOne({
      where: {
        token: generateTokenHash(token),
        [Op.or]: [
          { expires: { [Op.gt]: Sequelize.fn('NOW') } },
          { expires: null },
        ],
      },
      include: {
        association: 'user',
        include: [{
          association: 'channels',
          include: [{
            association: 'users',
            attributes: ['id', 'name'],
            where: {
              id: { [Op.ne]: Sequelize.col('User.id') },
              [Sequelize.col('channels.type')]: CHANNEL_TYPES.DM,
            },
          }],
        }, {
          association: 'bans',
          attributes: ['expires', 'flags'],
          where: {
            [Op.or]: [
              { expires: { [Op.gt]: Sequelize.fn('NOW') } },
              { expires: null },
            ],
          },
        }, {
          association: 'tpids',
          attributes: ['tpid', 'provider'],
          include: {
            association: 'bans',
            attributes: ['expires', 'flags'],
            where: {
              [Op.or]: [
                { expires: { [Op.gt]: Sequelize.fn('NOW') } },
                { expires: null },
              ],
            },
          },
        }, {
          association: 'blocked',
          attributes: ['id', 'name'],
        }],
      },
      raw: true,
      nested: true,
    });

    if (session) {
      /* rearrange values */
      const { user } = session;
      const { tpids, channels } = user;
      user.mailreg = false;
      let i = tpids.length;
      while (i > 0) {
        i -= 1;
        const tpid = tpids[i];
        const { provider, bans } = tpid;
        if (provider === THREEPID_PROVIDERS.EMAIL) {
          user.mailreg = true;
        }
        if (bans.length) {
          user.bans.push(bans);
        }
        delete tpid.bans;
      }

      user.channels = {};
      i = channels.length;
      while (i > 0) {
        i -= 1;
        const { id: cid, name, type, lastMessage, users } = channels[i];
        const channel = [name, type, lastMessage.getTime()];
        /* if its a DM, users is populated */
        if (users.length) {
          const dmPartner = users[0];
          channel.push(dmPartner.id);
          channel[0] = dmPartner.name;
        }
        user.channels[cid] = channel;
      }

      return user;
    }
  } catch (error) {
    console.error(`SQL Error on resolveSession: ${error.message}`);
  }
  return null;
}

export default Session;
