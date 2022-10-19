import { DataTypes } from 'sequelize';

import sequelize from './sequelize';

/*
 * banning a user happens by
 * - user itself
 * - email
 * - all available threepids
 */
const UserBan = sequelize.define('UserBan', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  /*
   * name and email at the time of ban,
   * stored seperately to account because user could delete it
   */
  name: {
    type: `${DataTypes.CHAR(32)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
  },

  email: {
    type: DataTypes.CHAR(40),
  },

  reason: {
    type: `${DataTypes.CHAR(200)} CHARSET utf8mb4 COLLATE utf8mb4_unicode_ci`,
    allowNull: false,
    set(value) {
      this.setDataValue('reason', value.slice(0, 200));
    },
  },

  /*
   * NULL if infinite
   */
  expires: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

/*
 * check if ThreePID is banned
 * @param provider, tpid What tpid to look for
 * @return boolean
 */
export async function isThreePidBanned(provider, tpid) {
  const count = await UserBan
    .count({
      include: {
        association: 'tpids',
        where: {
          provider,
          tpid,
        },
      },
    });
  return count !== 0;
}

export default UserBan;
