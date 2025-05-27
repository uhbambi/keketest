import { DataTypes } from 'sequelize';
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

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
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
        'createdAt',
      ],
      where: { uid },
      order: [['createdAt', 'DESC']],
      raw: true,
    });
    let i = fishModels.length;
    while (i > 0) {
      i -= 1;
      const { type, size, createdAt } = fishModels[i];
      fishes.push({ type, size, ts: createdAt.getTime() });
    }
  } catch {
    // nothing
  }
  return fishes;
}

export default Fish;
