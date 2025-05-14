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

export default Fish;
