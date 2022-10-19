import { Op } from 'sequelize';
import RegUser, { USERLVL } from './RegUser';
import Channel, { CHANNEL_TYPES } from './Channel';
import UserChannel from './UserChannel';
import Message from './Message';
import UserBlock from './UserBlock';
import IPInfo from './IPInfo';
import IPRange from './IPRange';
import IPBan from './IPBan';
import IPRangeBan from './IPRangeBan';
import IPWhitelist from './IPWhitelist';
import IPBanHistory from './IPBanHistory';
import IPRangeBanHistory from './IPRangeBanHistory';
import UserBan from './UserBan';
import UserBanHistory from './UserBanHistory';
import UserIP from './UserIP';
import ThreePID, { OATUH_PROVIDERS } from './ThreePID';

/*
 * Channels
 * (two belongsToMany associations to make it possible
 * to get both channels and dms in the same query with different includes)
 */
RegUser.belongsToMany(Channel, {
  as: 'channels',
  through: UserChannel,
});
RegUser.belongsToMany(Channel, {
  as: 'dms',
  through: UserChannel,
});
Channel.belongsToMany(RegUser, {
  as: 'users',
  through: UserChannel,
});

/*
 * ip informations of user
 */
IPInfo.belongsToMany(RegUser, {
  as: 'users',
  through: UserIP,
  foreignKey: 'ip',
});
RegUser.belongsToMany(IPInfo, {
  as: 'ips',
  through: UserIP,
  foreignKey: 'uid',
});

/*
 * third party ids for oauth login
 */
RegUser.hasMany(ThreePID, {
  as: 'tpids',
  foreignKey: 'uid',
});
ThreePID.belongsTo(RegUser, {
  as: 'user',
});

/*
 * ip range with whois info for ip
 */
IPRange.hasMany(IPInfo, {
  as: 'ips',
  foreignKey: {
    name: 'rid',
    allowNull: false,
  },
  onDelete: 'CASCADE',
});
IPInfo.belongsTo(IPRange, {
  as: 'range',
});

/*
 * ip bans
 */
IPBan.belongsTo(IPInfo, {
  as: 'ipinfo',
  foreignKey: {
    name: 'ip',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
IPInfo.hasOne(IPBan, {
  as: 'ban',
});
IPBan.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(IPBan, {
  as: 'ipBanActions',
});
/*
 * ip whitelist
 */
IPWhitelist.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(IPWhitelist, {
  as: 'ipWhitelistActions',
});
IPWhitelist.belongsTo(IPInfo, {
  as: 'ipinfo',
  foreignKey: {
    name: 'ip',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
IPInfo.hasOne(IPBan, {
  as: 'whitelist',
});
/*
 * range ban
 */
IPRangeBan.belongsTo(IPRange, {
  as: 'iprange',
  foreignKey: {
    name: 'rid',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
IPRange.hasOne(IPRangeBan, {
  as: 'ban',
});
IPRangeBan.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(IPRangeBan, {
  as: 'ipRangeBanActions',
});
/*
 * ip ban history
 */
IPBanHistory.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(IPBanHistory, {
  as: 'ipBanHistory',
});
IPBanHistory.belongsTo(IPInfo, {
  as: 'ipinfo',
  foreignKey: {
    name: 'ip',
    allowNull: false,
  },
  onDelete: 'CASCADE',
});
IPInfo.hasMany(IPBanHistory, {
  as: 'banHistory',
});
/*
 * ip range ban history
 */
IPRangeBanHistory.belongsTo(IPRange, {
  as: 'iprange',
  foreignKey: {
    name: 'rid',
    allowNull: false,
  },
  onDelete: 'CASCADE',
});
IPRange.hasOne(IPRangeBanHistory, {
  as: 'banHistory',
});
IPRangeBanHistory.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(IPRangeBanHistory, {
  as: 'ipRangeBanHistory',
});

/*
 * User bans
 */
UserBan.belongsToMany(ThreePID, {
  as: 'tpids',
  through: 'ThreePIDBan',
  foreignKey: 'bid',
});
ThreePID.belongsToMany(UserBan, {
  as: 'bans',
  through: 'ThreePIDBan',
  foreignKey: 'tid',
});
UserBan.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(UserBan, {
  as: 'userBanActions',
});
UserBan.belongsTo(RegUser, {
  as: 'user',
  foreignKey: 'uid',
});
RegUser.hasOne(UserBan, {
  as: 'ban',
});
/*
 * User ban history
 */
UserBanHistory.belongsToMany(ThreePID, {
  as: 'tpids',
  through: 'ThreePIDBanHistory',
  foreignKey: 'bid',
});
ThreePID.belongsToMany(UserBanHistory, {
  as: 'banHistory',
  through: 'ThreePIDBanHistory',
  foreignKey: 'tid',
});
UserBan.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(UserBan, {
  as: 'userBanHistory',
});
UserBanHistory.belongsTo(RegUser, {
  as: 'user',
  foreignKey: 'uid',
});
RegUser.hasMany(UserBanHistory, {
  as: 'banHistory',
});

/*
 * chat messages
 */
Message.belongsTo(Channel, {
  as: 'channel',
  foreignKey: 'cid',
  onDelete: 'CASCADE',
});
Message.belongsTo(RegUser, {
  as: 'user',
  foreignKey: 'uid',
  onDelete: 'CASCADE',
});

/*
 * User blocks of other user
 *
 * uid: User that blocks
 * buid: User that is blocked
 */
RegUser.belongsToMany(RegUser, {
  as: 'blocked',
  through: UserBlock,
  foreignKey: 'uid',
});
RegUser.belongsToMany(RegUser, {
  as: 'blockedBy',
  through: UserBlock,
  foreignKey: 'buid',
});

/*
 * includes for RegUsert
 * that should be available on ordinary
 * login
 */
const regUserQueryInclude = [{
  association: 'channels',
  where: {
    type: {
      [Op.not]: CHANNEL_TYPES.DM,
    },
  },
}, {
  association: 'dms',
  where: {
    type: CHANNEL_TYPES.DM,
  },
  include: [{
    association: 'users',
    attributes: ['id', 'name'],
  }],
}, {
  association: 'blocked',
  attributes: ['id', 'name'],
}];

export {
  // Models
  IPWhitelist,
  RegUser,
  Channel,
  UserChannel,
  Message,
  UserBlock,
  IPRange,
  IPInfo,
  ThreePID,
  // includes
  regUserQueryInclude,
  // constants
  USERLVL,
  OATUH_PROVIDERS,
  CHANNEL_TYPES,
};
