import Sequelize, { DataTypes } from 'sequelize';
import sequelize from './sequelize';

import RegUser from './RegUser';

const Fish = sequelize.define('Fish', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },

  type: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  size: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
}, {
  timestamps: true,
  updatedAt: false,
});

Fish.belongsTo(RegUser, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'cascade',
});

export async function storeFish(uid, type, size) {
  try {
    await Fish.create({
      uid,
      type,
      size,
    });
  } catch {
    // nothing
  }
}

export async function getFishesOfUser(uid) {
  const fishes = [];
  try {
    const fishModels = await Fish.findAll({
      attributes: [
        'type',
        'size',
        [
          Sequelize.fn('UNIX_TIMESTAMP', Sequelize.col('createdAt')),
          'ts',
        ],
      ],
      where: { uid },
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    let i = fishModels.length;
    while (i > 0) {
      i -= 1;
      const { type, size, ts } = fishModels[i];
      fishes.push({ type, size, ts });
    }
  } catch {
    // nothing
  }
  return fishes;
}

export default Fish;
