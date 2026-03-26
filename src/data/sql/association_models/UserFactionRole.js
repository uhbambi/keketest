/*
 *
 * Junction table for User -> Factions
 *
 */

import sequelize from '../sequelize.js';

const UserFactionRole = sequelize.define('UserFactionRole', {});

/*
 * triggers that keep the memberCount of Facion Roles synced
 */
UserFactionRole.afterSync(async () => {
  await sequelize.query(
    `CREATE TRIGGER IF NOT EXISTS after_user_faction_role_delete
AFTER DELETE ON UserFactionRoles FOR EACH ROW
BEGIN
  UPDATE FactionRoles SET memberCount = memberCount - 1 WHERE id = OLD.frid;
END`);
  await sequelize.query(
    `CREATE TRIGGER IF NOT EXISTS after_user_faction_role_insert
AFTER INSERT ON UserFactionRoles FOR EACH ROW
BEGIN
  UPDATE FactionRoles SET memberCount = memberCount + 1 WHERE id = NEW.frid;
END`);
});

export default UserFactionRole;
