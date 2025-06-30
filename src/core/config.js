/*
 * general config that is also available from client code can be found in
 * src/core/constants.js
 */
import fs from 'fs';
import path from 'path';

if (process.env.BROWSER) {
  throw new Error(
    'Do not import `config.js` from inside the client-side code.',
  );
}

let config = {};

(() => {
  const variables = [
    ['ASSET_DIR', 'string', '/assets'],
    ['PORT', 'int', 8080],
    ['HOST', 'string', '127.0.0.1'],
    ['USE_MAILER', 'bool', false],
    ['MAIL_ADDRESS', 'string', 'donotreply@example.com'],
    ['CONTACT_ADDRESS', 'string', 'admin@example.com'],
    ['TILE_FOLDER_REL', 'string', 'tiles'],
    ['USE_XREALIP', 'bool', false],
    ['BACKUP_URL', 'string', null],
    ['OUTGOING_ADDRESS', 'string', null],
    ['PUNISH_DOMINATOR', 'bool', false],
    ['USE_PROXYCHECK', 'bool', false],
    ['PROXYCHECK_KEY', 'string', null],
    ['REDIS_URL', 'string', 'redis://localhost:6379'],
    ['IS_CLUSTER', 'bool', false],
    ['CDN_URL', 'string', ''],
    ['API_URLS', 'array', null],
    ['UNSHARDED_HOST', 'string', null],
    ['BASENAME', 'string', ''],
    ['CORS_HOSTS', 'array', []],
    ['MYSQL_HOST', 'string', 'localhost'],
    ['MYSQL_DATABASE', 'string', 'pixelplanet'],
    ['MYSQL_USER', 'string', 'pixelplanet'],
    ['MYSQL_PW', 'string', 'sqlpassword'],
    ['LOG_MYSQL', 'bool', false],
    ['GUILDED_INVITE', 'string', 'https://www.guilded.gg/'],
    ['HOURLY_EVENT', 'bool', false],
    ['FISHING', 'bool', false],
    ['FISH_AMOUNT', 'int', 3],
    ['APISOCKET_KEY', 'string', null],
    ['ADMIN_IDS', 'numarray', []],
    ['CAPTCHA_TIME', 'int', 30],
    ['CAPTCHA_TIMEOUT', 'int', 120],
    ['TRUSTED_TIME', 'int', 48],
    ['WHOIS_DURATION', 'int', 240],
    ['PROXYCHECK_DURATION', 'int', 72],
    ['FACEBOOK_APP_ID', 'string', 'dummy'],
    ['FACEBOOK_APP_SECRET', 'string', 'dummy'],
    ['DISCORD_CLIENT_ID', 'string', 'dummy'],
    ['DISCORD_CLIENT_SECRET', 'string', 'dummy'],
    ['GOOGLE_CLIENT_ID', 'string', 'dummy'],
    ['GOOGLE_CLIENT_SECRET', 'string', 'dummy'],
    ['VK_CLIENT_ID', 'string', 'dummy'],
    ['VK_CLIENT_SECRET', 'string', 'dummy'],
    ['REDDIT_CLIENT_ID', 'string', 'dummy'],
    ['REDDIT_CLIENT_SECRET', 'string', 'dummy'],
    ['BACKUP_REDIS_URL', 'string', null],
    ['BACKUP_DIR', 'string', null],
    ['BACKUP_CMD', 'string', null],
    ['BACKUP_INTERVAL', 'int', 30],
  ];

  const configFileValues = {};
  try {
    fs.readFileSync(path.resolve('config.ini')).toString('utf8')
      .split('\n').forEach((line) => {
        line = line.trim();
        if (line.startsWith('#')) {
          return;
        }
        const seperator = line.indexOf('=');
        // eslint-disable-next-line
        if (seperator === -1 || seperator === 0 || seperator > line.length - 2) {
          return;
        }
        const key = line.substring(0, seperator).trim();
        let value = line.substring(seperator + 1).trim();
        if ((value.startsWith('"') && value.endsWith('"'))
          || (value.startsWith('\'') && value.endsWith('\''))
        ) {
          value = value.substring(1, value.length - 1);
        }
        configFileValues[key] = value;
      });
  } catch (error) {
    console.error(`Couldn't read config file ${error.message}`);
  }

  for (let i = 0; i < variables.length; i += 1) {
    const [key, type, def] = variables[i];

    let userValue = process.env[key];
    if (!userValue) {
      userValue = configFileValues[key];
    }
    let value;

    if (userValue) {
      switch (type) {
        case 'string': {
          value = userValue;
          break;
        }
        case 'int': {
          const num = parseInt(userValue, 10);
          if (Number.isNaN(num)) {
            value = def;
          } else {
            value = num;
          }
          break;
        }
        case 'bool': {
          /* eslint-disable max-len */
          userValue = userValue.toLowerCase();
          if (userValue === 'true' || userValue === 'yes' || userValue === '1') {
            value = true;
          } else if (userValue === 'false' || userValue === 'no' || userValue === '0') {
            value = false;
          } else {
            value = def;
          }
          /* eslint-enable max-len */
          break;
        }
        case 'array': {
          value = userValue.split(',').map((c) => c.trim()).filter((c) => c);
          break;
        }
        case 'numarray': {
          value = userValue.split(',').map((c) => c.trim()).filter((c) => c)
            .map((c) => parseInt(c, 10));
          break;
        }
        default:
          throw new Error(
            `Can not parse config value ${userValue} for ${key}`,
          );
      }
    } else {
      value = def;
    }

    config[key] = value;
  }

  /* generated values */
  config.TILE_FOLDER = path.resolve(config.TILE_FOLDER_REL);

  if (config.CDN_URL) {
    const cdnHost = config.CDN_URL.substring(config.CDN_URL.indexOf('//') + 2);
    const endHostSlash = cdnHost.indexOf('/', 8);
    if (endHostSlash !== -1) {
      config.CDN_HOST = cdnHost.substring(0, endHostSlash);
    } else {
      config.CDN_HOST = cdnHost;
    }
  } else {
    config.CDN_HOST = '';
  }
})();

export const {
  ASSET_DIR,
  PORT,
  HOST,
  USE_MAILER,
  MAIL_ADDRESS,
  CONTACT_ADDRESS,
  USE_XREALIP,
  BACKUP_URL,
  OUTGOING_ADDRESS,
  PUNISH_DOMINATOR,
  USE_PROXYCHECK,
  PROXYCHECK_KEY,
  REDIS_URL,
  IS_CLUSTER,
  CDN_URL,
  API_URLS,
  UNSHARDED_HOST,
  BASENAME,
  CORS_HOSTS,
  MYSQL_HOST,
  MYSQL_DATABASE,
  MYSQL_USER,
  MYSQL_PW,
  LOG_MYSQL,
  GUILDED_INVITE,
  HOURLY_EVENT,
  FISHING,
  FISH_AMOUNT,
  APISOCKET_KEY,
  ADMIN_IDS,
  CAPTCHA_TIME,
  CAPTCHA_TIMEOUT,
  TRUSTED_TIME,
  WHOIS_DURATION,
  PROXYCHECK_DURATION,
  FACEBOOK_APP_ID,
  FACEBOOK_APP_SECRET,
  DISCORD_CLIENT_ID,
  DISCORD_CLIENT_SECRET,
  GOOGLE_CLIENT_ID,
  GOOGLE_CLIENT_SECRET,
  VK_CLIENT_ID,
  VK_CLIENT_SECRET,
  REDDIT_CLIENT_ID,
  REDDIT_CLIENT_SECRET,
  TILE_FOLDER,
  CDN_HOST,
  BACKUP_REDIS_URL,
  BACKUP_DIR,
  BACKUP_CMD,
  BACKUP_INTERVAL,
} = config;

config = null;

/*
export const ASSET_DIR = '/assets';

export const PORT = process.env.PORT || 8080;
export const HOST = process.env.HOST || '127.0.0.1';

export const USE_MAILER = parseInt(process.env.USE_MAILER, 10) || false;
export const MAIL_ADDRESS = process.env.MAIL_ADDRESS
  || 'donotreply@example.com';
export const CONTACT_ADDRESS = process.env.CONTACT_ADDRESS
  || 'admin@example.com';

const TILE_FOLDER_REL = process.env.TILE_FOLDER || 'tiles';

// NOTE: calculated value!
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

// for running as cluster, either 0 or 1
export const IS_CLUSTER = parseInt(process.env.IS_CLUSTER, 10) || false;
/*
 * if CDN_URL is set, this url will be used to serve assets. NO ending '/'
 * e.g.: "https://cdn.pixelplanet.fun"
 */
/*
export const CDN_URL = process.env.CDN_URL || '';
/*
 * CDN_HOST is generated from CDN_URL
 */
// NOTE auto
/*
export const CDN_HOST = (() => {
  if (!CDN_URL) {
    return CDN_URL;
  }
  const cdnHost = CDN_URL.substring(CDN_URL.indexOf('//') + 2);
  const endHostSlash = cdnHost.indexOf('/', 8);
  return (endHostSlash !== -1) ? cdnHost.substring(0, endHostSlash) : cdnHost;
})();

/*
/* if API_URLS is set, this url will be used for apis,
/* e.g "https://pixelplanet.fun/lmao" will lead to
/* "https://pixelplanet.fun/lmao/ws" used for websockets,
/* This shall NOT end with "/"
 * It can be a comma seperated list as well, then a random one is chosen per
 * client, which can be used for load balancing.
 */
/*
export const API_URLS = (process.env.API_URLS)
  ? process.env.API_URLS.split(',').map((c) => c.trim()) : null;
// host for which we do not use API_URLS, useful for running on a second domain
export const UNSHARDED_HOST = process.env.UNSHARDED_HOST || null;
/*
 * if BASENAME is set, this path will be used for... everything
 * the intention is to be able to run pixelplant with in a path.
 * e.g "/hahaa" would lead for the whole game to run under
 * https://pixelplanet.fun/hahaa
 * This shall NOT end with "/"
 * This SHALL start with an "/"
 */
/*
export const BASENAME = process.env.BASENAME || '';
/*
/* list of hosts allowed to CORS, this will also allow all subdomains,
/* this is why they get prefixed with a dot here if they aren't v4 IPs
 */
/*
export const CORS_HOSTS = (process.env.CORS_HOSTS)
  ? process.env.CORS_HOSTS.split(',').map(
    // eslint-disable-next-line max-len
    (c) => ((c.split('.').length !== 4 && !c.startsWith('.')) ? `.${c.trim()}` : c.trim()),
  ) : [];

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
*/
