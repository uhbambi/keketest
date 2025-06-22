import { QueryTypes, DataTypes } from 'sequelize';

import sequelize, { nestQuery } from './sequelize.js';
import { generateToken, generateTokenHash } from '../../utils/hash.js';
import { HOUR, THREEPID_PROVIDERS } from '../../core/constants.js';
import { CHANNEL_TYPES } from './Channel.js';

const Session = sequelize.define('Session', {
  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

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
      await sequelize.query(
        // eslint-disable-next-line max-len
        `DELETE t FROM Sessions t JOIN (
  SELECT id FROM Sessions WHERE uid = :uid ORDER BY id ASC LIMIT 10
) AS oldest ON t.id = oldest.id`, {
          replacements: { uid },
          raw: true,
          type: QueryTypes.DELETE,
        });
    }

    const token = generateToken();
    const session = await Session.create({
      uid,
      token: generateTokenHash(token),
      expires: durationHours && new Date(Date.now() + durationHours * HOUR),
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
    let user = await sequelize.query(
      /* eslint-disable max-len */
      `SELECT u.id, u.name, u.password, u.userlvl, u.flags, u.lastSeen, u.createdAt,
t.tpid AS 'tpids.tpid', t.provider AS 'tpids.provider',
b.expires AS 'bans.expires', b.flags AS 'bans.flags',
c.id AS 'channels.cid', c.\`type\` AS 'channels.type', c.lastMessage AS 'channels.lastDate',
ucmd.uid AS 'channels.dmuid', ucu.name AS 'channels.dmuname',
bu.id AS 'blocked.id', bu.name AS 'blocked.name' FROM Users u
  INNER JOIN Sessions s ON s.uid = u.id
  LEFT JOIN ThreePIDs t ON t.uid = u.id
  LEFT JOIN ThreePIDBans tbm ON tbm.tid = t.id
  LEFT JOIN UserBans ubm ON ubm.uid =u.id
  LEFT JOIN Bans b ON b.id = ubm.bid  OR b.id = tbm.bid
  LEFT JOIN UserBlocks ub ON ub.uid = u.id
  LEFT JOIN Users bu ON bu.id = ub.buid
  LEFT JOIN UserChannels ucm ON ucm.uid =u.id
  LEFT JOIN Channels c ON c.id = ucm.cid
  LEFT JOIN UserChannels ucmd ON ucmd.cid = c.id AND c.type = ${CHANNEL_TYPES.DM} AND ucmd.uid != u.id
  LEFT JOIN Users ucu ON ucu.id = ucmd.uid
WHERE s.token = :token`, {
        /* eslint-enable max-len */
        replacements: { token },
        raw: true,
        type: QueryTypes.SELECT,
      });
    user = nestQuery(user);

    if (user) {
      /* rearrange values */
      const { tpids, channels } = user;
      user.mailreg = false;
      let i = tpids.length;
      while (i > 0) {
        i -= 1;
        if (tpids[i].provider === THREEPID_PROVIDERS.EMAIL) {
          user.mailreg = true;
          break;
        }
      }

      user.channels = {};
      i = channels.length;
      while (i > 0) {
        i -= 1;
        const { id: cid, name, type, lastDate, dmuid, dmuname } = channels[i];
        const channel = [name, type, lastDate.getTime()];
        /* if its a dm, this is set */
        if (dmuid) {
          channel.push(dmuid);
          channel[0] = dmuname;
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
