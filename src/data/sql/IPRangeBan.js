import { DataTypes } from 'sequelize';

import sequelize from './sequelize';

export { RANGEBAN_REASONS } from '../../core/constants';

const IPRangeBan = sequelize.define('IPRangeBan', {
  reason: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
  },

  expires: {
    type: DataTypes.DATE,
  },

  createdAt: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },
});

export default IPRangeBan;
