/*
 *
 * Database layout for Chat Message History
 *
 */

import Sequelize, { DataTypes } from 'sequelize';
import sequelize from './sequelize';
import Channel from './Channel';

const Message = sequelize.define('Message', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  flag: {
    type: DataTypes.CHAR(2),
    defaultValue: 'xx',
    allowNull: false,
  },

  message: {
    type: DataTypes.STRING(200),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
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
});

export async function storeMessage(
  flag, message, cid, uid,
) {
  try {
    await Promise.all([
      Channel.update({ lastMessage: Sequelize.fn('NOW') }, {
        where: { id: cid },
      }),
      Message.create({
        flag,
        message,
        cid,
        uid,
      }),
    ]);
  } catch (error) {
    console.error(`SQL Error on storeMessage: ${error.message}`);
  }
}

export async function getMessagesForChannel(cid, limit) {
  try {
    const models = await Message.findAll({
      attributes: [
        'message',
        'uid',
        'flag',
        [
          Sequelize.fn('UNIX_TIMESTAMP', Sequelize.col('createdAt')),
          'ts',
        ],
        [Sequelize.col('user.name'), 'name'],
      ],
      include: {
        association: 'user',
        attributes: [],
      },
      where: { cid },
      limit,
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    return models.map(({name, message, flag, uid, ts}) => [
      name, message, flag, uid, ts,
    ]);
  } catch (error) {
    console.error(`SQL Error on getMessagesForChannel: ${error.message}`);
  }
  return [];
}

export default Message;
