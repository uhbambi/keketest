/*
 * general config that is also available from client code can be found in
 * src/core/constants.js
 */
import path from 'path';

if (process.env.BROWSER) {
  throw new Error(
    'Do not import `config.js` from inside the client-side code.',
  );
}

export const ASSET_DIR = '/assets';

export const PORT = process.env.PORT || 8080;
export const HOST = process.env.HOST || '127.0.0.1';

export const USE_MAILER = parseInt(process.env.USE_MAILER, 10) || false;
export const MAIL_ADDRESS = process.env.MAIL_ADDRESS
  || 'donotreply@example.com';
export const CONTACT_ADDRESS = process.env.CONTACT_ADDRESS
  || 'admin@example.com';

const TILE_FOLDER_REL = process.env.TILE_FOLDER || 'tiles';
export const TILE_FOLDER = path.resolve(TILE_FOLDER_REL);

export const USE_XREALIP = !!process.env.USE_XREALIP;

export const BACKUP_URL = process.env.BACKUP_URL || null;

export const OUTGOING_ADDRESS = process.env.OUTGOING_ADDRESS || null;

// Punish when a country dominates
export const PUNISH_DOMINATOR = !!process.env.PUNISH_DOMINATOR;

// Proxycheck
export const USE_PROXYCHECK = parseInt(process.env.USE_PROXYCHECK, 10) || false;
export const { PROXYCHECK_KEY } = process.env;

export const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

// for running as cluster
export const IS_CLUSTER = parseInt(process.env.IS_CLUSTER, 10) || false;
// host for which we do not use shards, useful for running on multiple domains
export const UNSHARDED_HOST = process.env.UNSHARDED_HOST || null;
// if CSN_HOST is set, this host will be used to serve assets
export const CDN_HOST = process.env.CDN_HOST || null;
// list of hosts allowed to CORS, can be dot-prefixed to allow all subdomains
// like ".pixelplanet.fun"
export const CORS_HOSTS = (process.env.CORS_HOSTS)
  ? process.env.CORS_HOSTS.split(',') : [];

// Database
export const MYSQL_HOST = process.env.MYSQL_HOST || 'localhost';
export const MYSQL_DATABASE = process.env.MYSQL_DATABASE || 'pixelplanet';
export const MYSQL_USER = process.env.MYSQL_USER || 'pixelplanet';
export const MYSQL_PW = process.env.MYSQL_PW || 'sqlpassword';

// Social
export const GUILDED_INVITE = process.env.GUILDED_INVITE
  || 'https://www.guilded.gg/';

// Logging
export const LOG_MYSQL = parseInt(process.env.LOG_MYSQL, 10) || false;

// do hourly event
export const HOURLY_EVENT = parseInt(process.env.HOURLY_EVENT, 10) || false;
// do fishing events
export const FISHING = parseInt(process.env.FISHING, 10) || false;
export const FISH_AMOUNT = parseInt(process.env.FISH_AMOUNT, 10) || 3;

// Accounts
export const APISOCKET_KEY = process.env.APISOCKET_KEY || null;
// Comma separated list of user ids of Admins
export const ADMIN_IDS = (process.env.ADMIN_IDS)
  ? process.env.ADMIN_IDS.split(',').map((z) => parseInt(z, 10)) : [];

export const auth = {
  // https://developers.facebook.com/
  facebook: {
    clientID: process.env.FACEBOOK_APP_ID || 'dummy',
    clientSecret: process.env.FACEBOOK_APP_SECRET || 'dummy',
  },
  // https://discordapp.com/developers/applications/me
  discord: {
    clientID: process.env.DISCORD_CLIENT_ID || 'dummy',
    clientSecret: process.env.DISCORD_CLIENT_SECRET || 'dummy',
  },
  // https://cloud.google.com/console/project
  google: {
    clientID: process.env.GOOGLE_CLIENT_ID || 'dummy',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'dummy',
  },
  // vk.com/dev
  vk: {
    clientID: process.env.VK_CLIENT_ID || 'dummy',
    clientSecret: process.env.VK_CLIENT_SECRET || 'dummy',
  },
  // https://www.reddit.com/prefs/apps
  reddit: {
    clientID: process.env.REDDIT_CLIENT_ID || 'dummy',
    clientSecret: process.env.REDDIT_CLIENT_SECRET || 'dummy',
  },
};

// time on which to display captcha in minutes
export const CAPTCHA_TIME = parseInt(process.env.CAPTCHA_TIME, 10) || 30;
// time during which the user can solve a captcha in seconds
export const CAPTCHA_TIMEOUT = parseInt(process.env.CAPTCHA_TIMEOUT, 10) || 120;
// time in which an ip is marked as trusted in hours
export const TRUSTED_TIME = parseInt(process.env.TRUSTED_TIME, 10) || 48;
// duration WHOIS data is stored in hours
export const WHOIS_DURATION = parseInt(process.env.WHOIS_DURATION, 10) || 240;
// duration ProxyCheck data is stored in hours
// eslint-disable-next-line max-len
export const PROXYCHECK_DURATION = parseInt(process.env.PROXYCHECK_DURATION, 10) || 72;
