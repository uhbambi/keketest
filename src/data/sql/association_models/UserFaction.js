/*
 *
 * Junction table for User -> Factions
 *
 */

import { DataTypes } from 'sequelize';
import sequelize from '../sequelize.js';

const UserFaction = sequelize.define('UserFaction', {
  joined: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
    allowNull: false,
  },

  /*
   * from lowest to highest bit
   * 0: hide from profile
   */
  flags: {
    type: DataTypes.TINYINT.UNSIGNED,
    allowNull: false,
    defaultValue: 0,
  },
});

/*
 * triggers that keep the memberCount of Factions synced
 */
UserFaction.afterSync(async () => {
  await sequelize.query(
    `CREATE TRIGGER IF NOT EXISTS after_user_factions_delete
AFTER DELETE ON UserFactions FOR EACH ROW
BEGIN
    UPDATE Factions SET memberCount = memberCount - 1 WHERE id = OLD.fid;
END`);
  await sequelize.query(
    `CREATE TRIGGER IF NOT EXISTS after_user_factions_insert
AFTER INSERT ON UserFactions FOR EACH ROW
BEGIN
    UPDATE Factions SET memberCount = memberCount + 1 WHERE id = NEW.fid;
END`);
});

export default UserFaction;
