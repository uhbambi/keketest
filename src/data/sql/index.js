import User, { USERLVL } from './User';
import Channel, { CHANNEL_TYPES } from './Channel';
import Message from './Message';
import Session from './Session';
import IP from './IP';
import ProxyData from './Proxy';
import RangeData from './Range';
import Ban from './Ban';
import BanHistory from './BanHistory';
import WhoisReferral from './WhoisReferral';
import RangeBan from './RangeBan';
import RangeBanHistory from './RangeBanHistory';
import ProxyWhitelist from './ProxyWhitelist';
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
 */
User.belongsToMany(Channel, {
  as: 'channels',
  through: UserChannel,
  foreignKey: 'uid',
});
Channel.belongsToMany(User, {
  as: 'users',
  through: UserChannel,
  foreignKey: 'cid',
});

/*
 * Fish
 */
Fish.belongsTo(User, {
  as: 'user',
  foreignKey: {
    name: 'uid',
    allowNull: false,
  },
  onDelete: 'CASCADE',
});

/*
 * ip informations of user
 */
IP.belongsToMany(User, {
  as: 'users',
  through: UserIP,
  foreignKey: 'ip',
});
User.belongsToMany(IP, {
  as: 'ips',
  through: UserIP,
  foreignKey: 'uid',
});

/*
 * user sessions
 */
Session.belongsTo(User, {
  as: 'user',
  foreignKey: {
    name: 'uid',
    allowNull: false,
  },
  onDelete: 'CASCADE',
});
User.hasMany(Session, {
  as: 'sessions',
});

/*
 * proxy information of ip
 */
ProxyData.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: {
    name: 'ip',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
IP.hasOne(ProxyData, {
  as: 'proxy',
  foreignKey: 'ip',
});

/*
 * third party ids for oauth login
 */
ThreePID.belongsTo(User, {
  as: 'user',
  foreignKey: 'uid',
});
User.hasMany(ThreePID, {
  as: 'tpids',
});

/*
 * ip range with whois info for ip
 */
IP.belongsTo(RangeData, {
  as: 'range',
  foreignKey: 'rid',
});

RangeData.hasMany(IP, {
  as: 'ips',
});
/*
 * generic ban by threepid, userid and ip
 */
Ban.belongsToMany(IP, {
  as: 'ips',
  through: IPBan,
  foreignKey: 'bid',
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
  foreignKey: 'bid',
});
ThreePID.belongsToMany(Ban, {
  as: 'bans',
  through: ThreePIDBan,
  foreignKey: 'tid',
});
// user
Ban.belongsToMany(User, {
  as: 'users',
  through: UserBan,
  foreignKey: 'bid',
});
User.belongsToMany(Ban, {
  as: 'bans',
  through: UserBan,
  foreignKey: 'uid',
});
// mods
Ban.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(Ban, {
  as: 'banActions',
});
/*
 * history of past bans
 */
BanHistory.belongsToMany(IP, {
  as: 'ips',
  through: IPBanHistory,
  foreignKey: 'bid',
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
  foreignKey: 'bid',
});
ThreePID.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: ThreePIDBanHistory,
  foreignKey: 'tid',
});
// user
BanHistory.belongsToMany(User, {
  as: 'users',
  through: UserBanHistory,
  foreignKey: 'bid',
});
User.belongsToMany(BanHistory, {
  as: 'banHistory',
  through: UserBanHistory,
  foreignKey: 'uid',
});
// mods
BanHistory.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(BanHistory, {
  as: 'banActionHistory',
});
BanHistory.belongsTo(User, {
  as: 'lmod',
  foreignKey: 'lmuid',
});
User.hasMany(BanHistory, {
  as: 'banLiftingHistory',
});

/*
 * ip whitelist
 */
ProxyWhitelist.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(ProxyWhitelist, {
  as: 'ipWhitelistActions',
});
ProxyWhitelist.belongsTo(IP, {
  as: 'ipinfo',
  foreignKey: {
    name: 'ip',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
IP.hasOne(ProxyWhitelist, {
  as: 'whitelist',
  foreignKey: 'ip',
});

/*
 * range ban
 */
RangeBan.belongsTo(RangeData, {
  as: 'iprange',
  foreignKey: {
    name: 'rid',
    allowNull: false,
    primaryKey: true,
  },
  onDelete: 'CASCADE',
});
RangeData.hasOne(RangeBan, {
  as: 'bans',
  foreignKey: 'rid',
});
RangeBan.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(RangeBan, {
  as: 'rangeBanActions',
});

/*
 * ip range ban history
 */
RangeBanHistory.belongsTo(RangeData, {
  as: 'iprange',
  foreignKey: {
    name: 'rid',
    allowNull: false,
  },
  onDelete: 'CASCADE',
});
RangeData.hasMany(RangeBanHistory, {
  as: 'banHistory',
});
RangeBanHistory.belongsTo(User, {
  as: 'mod',
  foreignKey: 'muid',
});
User.hasMany(RangeBanHistory, {
  as: 'rangeBanActionHistory',
});
RangeBanHistory.belongsTo(User, {
  as: 'lmod',
  foreignKey: 'lmuid',
});
User.hasMany(RangeBanHistory, {
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
Message.belongsTo(User, {
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
User.belongsToMany(User, {
  as: 'blocked',
  through: UserBlock,
  foreignKey: 'uid',
});
User.belongsToMany(User, {
  as: 'blockedBy',
  through: UserBlock,
  foreignKey: 'buid',
});

export {
  // Models
  ProxyWhitelist,
  User,
  Channel,
  UserChannel,
  Message,
  UserBlock,
  RangeData,
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
