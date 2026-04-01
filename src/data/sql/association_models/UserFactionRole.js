/*
 *
 * Junction table for User -> Factions
 *
 */

import sequelize from '../sequelize.js';

const UserFactionRole = sequelize.define('UserFactionRole', {});

export default UserFactionRole;
