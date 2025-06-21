import Sequelize, { DataTypes } from 'sequelize';
import sequelize from './sequelize';

const BanHistory = sequelize.define('BanHistory', {
  id: {
    type: DataTypes.BIGINT.UNSIGNED,
    primaryKey: true,
  },

  uuid: {
    type: 'BINARY(16)',
    allowNull: false,
    unique: 'uuid',
  },

  reason: {
    type: DataTypes.STRING(200),
    charset: 'utf8mb4',
    collate: 'utf8mb4_unicode_ci',
    allowNull: false,
  },

  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },

  started: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  ended: {
    type: DataTypes.DATE,
    allowNull: false,
  },

  liftedAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
});

export default BanHistory;
