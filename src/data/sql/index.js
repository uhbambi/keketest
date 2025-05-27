import { Op } from 'sequelize';
import RegUser, { USERLVL } from './RegUser';
import Channel, { CHANNEL_TYPES } from './Channel';
import Message from './Message';
import IP from './IP';
import ProxyData from './ProxyData';
import Range from './Range';
import Ban from './Ban';
import BanHistory from './BanHistory';
import WhoisReferral from './WhoisReferral';
import RangeBan from './RangeBan';
import RangeBanHistory from './RangeBanHistory';
import IPWhitelist from './IPWhitelist';
import ThreePID, { THREEPID_PROVIDERS } from './ThreePID';
import Fish from './Fish';
import UserIP from './association_models/UserIP';
import UserBlock from './association_models/UserBlock';
import UserChannel from './association_models/UserChannel';
import IPBan from './association_models/IPBan';
import UserBan from './association_models/UserBan';
import ThreePIDBan from './association_models/ThreePIDBan';
import IPBanHistory from './association_models/IPBanHistory';
import UserBanHistory from './association_models/UserBanHistory';
import ThreePIDBanHistory from './association_models/ThreePIDBanHistory';

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
IP.belongsToMany(RegUser, {
  as: 'users',
  through: UserIP,
  foreignKey: 'ip',
});
RegUser.belongsToMany(IP, {
  as: 'ips',
  through: UserIP,
  foreignKey: 'uid',
});

/*
 * proxy information of ip
 */
ProxyData.belongsTo(IP, {
  as: 'ip',
  foreignKey: {
    name: 'ip',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
Range.hasOne(RangeBan, {
  as: 'proxy',
});

/*
 * third party ids for oauth login
 */
ThreePID.belongsTo(RegUser, {
  as: 'user',
  foreignKey: 'uid',
});
RegUser.hasMany(ThreePID, {
  as: 'tpids',
});

/*
 * ip range with whois info for ip
 */
IP.belongsTo(Range, {
  as: 'range',
  foreignKey: 'rid',
});

Range.hasMany(IP, {
  as: 'ips',
});
/*
 * generic ban by threepid, userid and ip
 */
Ban.belongsToMany(IP, {
  as: 'ips',
  through: IPBan,
  foreignKey: 'buuid',
});
IP.belongsToMany(Ban, {
  as: 'bans',
  through: IPBan,
  foreignKey: 'ip',
});
// tpid
Ban.belongsToMany(ThreePID, {
  as: 'tpids',
  through: ThreePIDBan,
  foreignKey: 'buuid',
});
ThreePID.belongsToMany(Ban, {
  as: 'bans',
  through: ThreePIDBan,
  foreignKey: 'tid',
});
// user
Ban.belongsToMany(RegUser, {
  as: 'users',
  through: UserBan,
  foreignKey: 'buuid',
});
RegUser.belongsToMany(Ban, {
  as: 'bans',
  through: UserBan,
  foreignKey: 'uid',
});
// mods
Ban.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(Ban, {
  as: 'banActions',
});
/*
 * history of past bans
 */
BanHistory.belongsToMany(IP, {
  as: 'ips',
  through: IPBanHistory,
  foreignKey: 'buuid',
});
IP.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: IPBanHistory,
  foreignKey: 'ip',
});
// tpid
BanHistory.belongsToMany(ThreePID, {
  as: 'tpids',
  through: ThreePIDBanHistory,
  foreignKey: 'buuid',
});
ThreePID.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: ThreePIDBanHistory,
  foreignKey: 'tid',
});
// user
BanHistory.belongsToMany(RegUser, {
  as: 'users',
  through: UserBanHistory,
  foreignKey: 'buuid',
});
RegUser.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: UserBanHistory,
  foreignKey: 'uid',
});
// mods
BanHistory.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(BanHistory, {
  as: 'banActionHistory',
});
BanHistory.belongsTo(RegUser, {
  as: 'lmod',
  foreignKey: 'lmuid',
});
RegUser.hasMany(BanHistory, {
  as: 'banLiftingHistory',
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
IPWhitelist.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: {
    name: 'ip',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
IP.hasOne(IPWhitelist, {
  as: 'whitelist',
});

/*
 * range ban
 */
RangeBan.belongsTo(Range, {
  as: 'iprange',
  foreignKey: {
    name: 'rid',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
Range.hasOne(RangeBan, {
  as: 'bans',
});
RangeBan.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(RangeBan, {
  as: 'ipRangeBanActions',
});

/*
 * ip range ban history
 */
RangeBanHistory.belongsTo(Range, {
  as: 'iprange',
  foreignKey: {
    name: 'rid',
    allowNull: false,
  },
  onDelete: 'CASCADE',
});
Range.hasMany(RangeBanHistory, {
  as: 'banHistory',
});
RangeBanHistory.belongsTo(RegUser, {
  as: 'mod',
  foreignKey: 'muid',
});
RegUser.hasMany(RangeBanHistory, {
  as: 'ipRangeBanActionHistory',
});
RangeBanHistory.belongsTo(RegUser, {
  as: 'lmod',
  foreignKey: 'lmuid',
});
RegUser.hasMany(RangeBanHistory, {
  as: 'rangeBanLiftingHistory',
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

export {
  // Models
  IPWhitelist,
  RegUser,
  Channel,
  UserChannel,
  Message,
  UserBlock,
  Range,
  IP,
  Ban,
  WhoisReferral,
  ThreePID,
  Fish,
  // constants
  USERLVL,
  THREEPID_PROVIDERS,
  CHANNEL_TYPES,
};
