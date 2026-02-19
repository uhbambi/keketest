/*
 *
 * Database layout for Chat Messages
 *
 */

import { DataTypes, QueryTypes } from 'sequelize';
import sequelize from './sequelize.js';
import { CHANNEL_TYPES } from '../../core/constants.js';
import mapFlag from '../../utils/flagMapping.js';
import parseLinksFromMd from '../../utils/markdown/linkParser.js';
import { getMediaFromLinks } from '../../utils/media/serverUtils.js';

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  cid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  uid: {
    type: DataTypes.INTEGER.UNSIGNED,
    allowNull: false,
  },

  message: {
    type: `${DataTypes.STRING(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    set(value) {
      this.setDataValue('message', value.slice(0, 200));
    },
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
}, {
  indexes: [
    {
      name: 'messages_cid_id_desc',
      fields: ['cid', 'id'],
      order: { id: 'DESC' },
    },
  ],
});

/**
 * store message, may throw an Error
 * @param message
 * @param cid channel id
 * @param uid user id
 * @return message id or null
 */
export async function storeMessage(message, cid, uid) {
  if (message.length > 200) {
    throw new Error('too_long');
  }
  const media = getMediaFromLinks(parseLinksFromMd(message));
  if (media.length > 3) {
    throw new Error('too_many_files');
  }

  try {
    const transaction = await sequelize.transaction();

    try {
      await Promise.all([
        sequelize.query(
          'UPDATE Channels SET lastMessage = NOW() WHERE id = ?', {
            replacements: [cid],
            raw: true,
            type: QueryTypes.UPDATE,
            transaction,
          },
        ),
        sequelize.query(
          // eslint-disable-next-line max-len
          'INSERT INTO Messages (message, uid, cid, createdAt) VALUES (?, ?, ?, NOW())', {
            replacements: [message, uid, cid],
            raw: true,
            type: QueryTypes.INSERT,
            transaction,
          },
        ),
      ]);
      const model = await sequelize.query(
        'SELECT LAST_INSERT_ID() AS id', {
          plain: true,
          type: QueryTypes.SELECT,
          transaction,
        },
      );
      if (!model.id) {
        throw new Error('no_id');
      }

      if (media.length) {
        await sequelize.query(
          // eslint-disable-next-line max-len
          `INSERT INTO MessageMedia (sid, mid) SELECT ?, m.id FROM Media m WHERE ${
            media.map(
              () => '( m.shortId = ? AND m.extension = ? )',
            ).join(' OR ')
          }`, {
            replacements: [model.id, ...media.flat()],
            raw: true,
            type: QueryTypes.INSERT,
            transaction,
          });
      }

      await transaction.commit();
      return model.id;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  } catch (error) {
    console.error(`SQL Error on storeMessage: ${error.message}`);
    throw new Error('store_error');
  }
}

/**
 * delete all messages of a user written in public channels
 * @param uid user id
 * @return success
 */
export async function deletePublicUserMessages(uid) {
  if (!uid) {
    return false;
  }
  try {
    await sequelize.query(
      `DELETE m FROM Messages m
  INNER JOIN Channels c ON m.cid = c.id
WHERE m.uid = ? AND c.type = ?`, {
        replacements: [uid, CHANNEL_TYPES.PUBLIC],
        raw: true,
        type: QueryTypes.DELETE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on deleteUserMessages: ${error.message}`);
  }
  return false;
}

/**
 * delete speciic message
 * @param mid message id
 * @return success
 */
export async function deleteMessage(mid) {
  if (!mid) {
    return false;
  }
  try {
    await sequelize.query(
      'DELETE FROM Messages WHERE id = ?', {
        replacements: [mid],
        raw: true,
        type: QueryTypes.DELETE,
      },
    );
    return true;
  } catch (error) {
    console.error(`SQL Error on deleteUserMessages: ${error.message}`);
  }
  return false;
}

/**
 * get recent history of channel
 * @param cid channel id
 * @param limit amount of last messages to get
 * @return [[name, message, flag, userId, ts, msgId, avatarId], ...]
 */
export async function getMessagesForChannel(cid, limit) {
  try {
    const models = await sequelize.query(
      `SELECT m.id AS msgId, m.message, m.uid AS userId,
UNIX_TIMESTAMP(m.createdAt) AS 'ts',
u.name, u.userlvl, p.customFlag, s.country,
COALESCE(CONCAT(a.shortId, ':', a.extension), NULL) AS avatarId FROM Messages m
  INNER JOIN Users u ON u.id = m.uid
  LEFT JOIN Profiles p ON p.uid = u.id
  LEFT JOIN Media a ON a.id = p.avatar
  LEFT JOIN Sessions s ON s.uid = u.id AND s.country != 'xx'
WHERE m.cid = ? ORDER BY m.createdAt DESC LIMIT ?`, {
        replacements: [cid, limit],
        raw: true,
        type: QueryTypes.SELECT,
      },
    );
    const rows = [];
    let i = models.length;
    while (i > 0) {
      i -= 1;
      const model = models[i];
      const { name, message, userId, ts, msgId, avatarId } = model;
      const [flagLegit, flag] = mapFlag(
        model.customFlag, model.userlvl, model.country,
      );
      rows.push([name, message, flag, userId, ts, msgId, flagLegit, avatarId]);
    }
    return rows;
  } catch (error) {
    console.error(`SQL Error on getMessagesForChannel: ${error.message}`);
  }
  return [];
}

export default Message;
