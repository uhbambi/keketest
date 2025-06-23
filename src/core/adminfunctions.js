/*
 * functions for admintools
 *
 */

/* eslint-disable no-await-in-loop */

import sharp from 'sharp';

import { validateCoorRange } from '../utils/validation.js';
import CanvasCleaner from './CanvasCleaner.js';
import socketEvents from '../socket/socketEvents.js';
import { USERLVL } from '../data/sql/index.js';
import { giveEveryoneAFish } from './Fishing.js';
import { forceCaptcha, resetAllCaptchas } from '../data/redis/captcha.js';
import { rollCaptchaFonts } from './captchaserver.js';
import { getBanInfos } from '../data/sql/Ban.js';
import { ban, unban, whitelist, unwhitelist } from './ban.js';
import {
  getInfoToIp,
  getIPofIID,
  getIIDofIP,
} from '../data/sql/IP.js';
import {
  getUserInfos, setUserLvl, getUserByUserLvl, name2Id,
} from '../data/sql/User.js';
import {
  getIIDSummary,
  getIIDPixels,
  getSummaryFromArea,
  getPixelsFromArea,
} from './parsePixelLog.js';
import canvases from './canvases.js';
import {
  imageABGR2Canvas,
  protectCanvasArea,
} from './Image.js';
import rollbackCanvasArea from './rollback.js';

/*
 * Execute IP based actions (banning, whitelist, etc.)
 * @param action what to do with the ip
 * @param ip already sanitized ip
 * @return text of success
 */
export async function executeIPAction(action, ips, logger = null) {
  const valueArray = ips.split('\n');
  let out = '';
  for (let i = 0; i < valueArray.length; i += 1) {
    const value = valueArray[i].trim();
    if (!value) {
      continue;
    }

    if (logger) logger(`${action} ${value}`);

    if (action === 'iidtoip') {
      const ip = await getIPofIID(value);
      out += (ip) ? `${ip}\n` : `${value}\n`;
      continue;
    }

    if (action === 'iptoiid') {
      const iid = await getIIDofIP(value);
      out += (iid) ? `${iid}\n` : `${value}\n`;
    }
  }
  return out;
}

export async function executeQuickAction(action, logger = null) {
  if (logger) logger(action);

  switch (action) {
    case 'rollcaptchafonts': {
      const fonts = await rollCaptchaFonts();
      return `Rolled captcha fonts: ${fonts.join(',')}`;
    }
    case 'resetcaptchas': {
      const amount = await resetAllCaptchas();
      return `Reset ${amount} Captchas and JS Challenges!`;
    }
    case 'enableverify': {
      socketEvents.broadcastVerificationRequirement(true);
      return 'Enabled Verification Requirement';
    }
    case 'disableverify': {
      socketEvents.broadcastVerificationRequirement(false);
      return 'Disabled Verification Requirement';
    }
    case 'givefishes': {
      giveEveryoneAFish();
      return 'Gave Fishes to everyone';
    }
    default:
      throw new Error('Unknown quick action!');
  }
}

/**
 * print informations of ban
 * @param ban Array of ban models
 * @return string with informations
 */
function printBans(bans) {
  let out = '';

  let i = bans.length;
  while (i > 0) {
    i -= 1;
    const {
      buuid, reason, flags, expires, createdAt, muid, mname, users, tpids, ips,
    } = bans[i];
    let type = '';
    if (flags & 0x01) type = 'Ban';
    else if (flags & 0x02) {
      if (type) {
        type += ' & ';
      }
      type += 'Mute';
    }
    out += `${type}: ${buuid}\nReason: ${reason}\n`;
    if (expires) out += `Expires: ${expires.toLocaleString()}\n`;
    out += `Created: ${createdAt.toLocaleString()}\n`;
    if (muid) {
      out += `by: @[${mname}](${muid})\n`;
    }
    out += 'Affects: ';
    if (users?.length) out += ` Users: ${users.map((u) => u.id).join(', ')} `;
    if (tpids?.length) out += `${tpids.length} TPIDS `;
    if (ips?.length) {
      out += `IPs: ${ips.map(
        // eslint-disable-next-line max-len
        (ib) => `${ib.ipString.substring(0, ib.ipString.indexOf('.') + 3)}x.xxx.xxx`,
      ).join(', ')}`;
    }
    out += '\n';
    if (i > 0) {
      out += '\n';
    }
  }
  return out;
}

/**
 * Execute IID based actions
 * @param action what to do with the iid
 * @param iid already sanitized iid
 * @return text of success
 */
export async function executeIIDAction(
  action,
  iid,
  bid,
  iidOrUserId,
  /* list of either iid, bid or userid */
  identifiers,
  reason,
  /* duration in ms */
  time,
  muid,
  logger = null,
) {
  if (logger) logger(`${action} ${iid} ${bid} ${iidOrUserId} ${identifiers}`);

  let duration;
  const identifierUuidList = [];
  const identifierUserIdList = [];

  switch (action) {
    case 'givecaptcha':
    case 'whitelist':
    case 'unwhitelist': {
      if (!iid) {
        return 'You must enter an IID';
      }
      break;
    }
    case 'baninfo': {
      if (!bid) {
        return 'You must enter an BID';
      }
      break;
    }
    case 'status': {
      if (!iidOrUserId) {
        return 'You must enter an IID or BID';
      }
      break;
    }
    case 'ban': {
      duration = Math.ceil(parseInt(time, 10) / 1000);
      if (Number.isNaN(duration) || (duration < 0)) {
        return 'No valid expiration time';
      }
      if (!reason?.trim()) {
        return 'You must enter a reason';
      }
      // fall through
    }
    case 'unban': {
      if (!identifiers) {
        return 'You must enter at least one IID, User Id or BID';
      }
      identifiers.split('\n').forEach((i) => {
        i = i.trim();
        if (i.indexOf('-') !== -1) {
          identifierUuidList.push(i);
        } else {
          const userId = parseInt(i, 10);
          identifierUserIdList.push(userId);
        }
      });
      break;
    }
    default:
      // nothing
  }

  let ipString;
  if (iid) {
    ipString = await getIPofIID(iid);
    if (!ipString) {
      return `Could not resolve ${iid}`;
    }
  }

  switch (action) {
    case 'status': {
      if (iidOrUserId.indexOf('-') !== -1 || iidOrUserId.indexOf('.') !== -1) {
        /* is IID */
        const ip = await getInfoToIp(iidOrUserId);
        if (!ip) {
          return 'No such IID found';
        }
        const {
          country, cidr, org,
          descr, asn, type, isProxy, isWhitelisted,
        } = ip;
        // eslint-disable-next-line max-len
        let out = `IP: ${iidOrUserId}\nCountry: ${country}\nCIDR: ${cidr}\norg: ${org}\ndesc: ${descr}\nasn: ${asn}\nType: ${type}\nisProxy: ${isProxy}\nisWhitelisted: ${isWhitelisted}\n`;
        const banInfos = await getBanInfos(ip.ipString, null, null, null);
        if (banInfos?.length) {
          out += '\n';
          out += printBans(banInfos);
        }
        return out;
      }
      const userId = parseInt(iidOrUserId, 10);
      const user = await getUserInfos(userId);
      if (!user) {
        return 'No such user found';
      }
      // eslint-disable-next-line max-len
      let out = `ID: ${userId}\nName: ${user.name}\nUserlvl: ${user.userlvl}\nFlags: ${user.flags}\n`;
      const banInfos = await getBanInfos(null, userId, null, null);
      if (banInfos?.length) {
        out += '\n';
        out += printBans(banInfos);
      }
      return out;
    }
    case 'baninfo': {
      const banInfos = await getBanInfos(null, null, null, bid);
      if (!banInfos?.length) {
        return 'No such ban found';
      }
      return printBans(banInfos);
    }
    case 'givecaptcha': {
      const succ = await forceCaptcha(ipString);
      if (succ === null) {
        return 'Captchas are deactivated on this server.';
      }
      if (succ) {
        return `Forced captcha on ${iid}`;
      }
      return `${iid} would have gotten captcha anyway`;
    }
    case 'ban': {
      const [bannedIpStrings, bannedUserIds] = await ban(
        null, identifierUserIdList, identifierUuidList,
        false, true, reason, duration || null, muid,
      );
      if (bannedIpStrings.length || bannedUserIds.length) {
        return 'Successfully banned user';
      }
      return 'Updated existing ban of user';
    }
    case 'unban': {
      const [unbannedIpStrings, unbannedUserIds] = await unban(
        null, identifierUserIdList, identifierUuidList, identifierUuidList,
        false, true, muid,
      );
      let ret = '';
      if (unbannedIpStrings.length) {
        ret += `Unbanned IPs: ${unbannedIpStrings.map(
          (i) => `${i.substring(0, i.indexOf('.'))}.xxx.xxx.xxx`,
        ).join(', ')}`;
      }
      if (unbannedUserIds.length) {
        if (ret) ret += '\n';
        ret += `Unbanned UserIds: ${unbannedUserIds.join(', ')}`;
      }
      if (ret) {
        return ret;
      }
      return 'No applying Ban found';
    }
    case 'whitelist': {
      const ret = await whitelist(ipString);
      if (ret) {
        return 'Successfully whitelisted user';
      }
      return 'User is already whitelisted';
    }
    case 'unwhitelist': {
      const ret = await unwhitelist(ipString);
      if (ret) {
        return 'Successfully removed user from whitelist';
      }
      return 'User is not on whitelist';
    }
    default:
      return `Failed to ${action}`;
  }
}


/*
 * Execute Image based actions (upload, protect, etc.)
 * @param action what to do with the image
 * @param file imagefile
 * @param coords coord sin X_Y format
 * @param canvasid numerical canvas id as string
 * @return [ret, msg] http status code and message
 */
export async function executeImageAction(
  action,
  buffer,
  coords,
  canvasid,
  logger = null,
) {
  if (!coords) {
    return [403, 'Coordinates not defined'];
  }
  if (!canvasid) {
    return [403, 'canvasid not defined'];
  }
  if (!buffer) {
    return [403, 'No file given'];
  }

  const splitCoords = coords.trim().split('_');
  if (splitCoords.length !== 2) {
    return [403, 'Invalid Coordinate Format'];
  }
  const [x, y] = splitCoords.map((z) => Math.floor(Number(z)));

  const canvas = canvases[canvasid];

  let error = null;
  if (Number.isNaN(x)) {
    error = 'x is not a valid number';
  } else if (Number.isNaN(y)) {
    error = 'y is not a valid number';
  } else if (!action) {
    error = 'No imageaction given';
  } else if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (canvas.v) {
    error = 'Can not upload Image to 3D canvas';
  }
  if (error !== null) {
    return [403, error];
  }

  const canvasMaxXY = canvas.size / 2;
  const canvasMinXY = -canvasMaxXY;
  if (x < canvasMinXY || y < canvasMinXY
      || x >= canvasMaxXY || y >= canvasMaxXY) {
    return [403, 'Coordinates are outside of canvas'];
  }

  const protect = (action === 'protect');
  const wipe = (action === 'wipe');

  try {
    const { data, info } = await sharp(buffer)
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });

    const pxlCount = await imageABGR2Canvas(
      canvasid,
      x, y,
      data,
      info.width, info.height,
      wipe, protect,
    );

    // eslint-disable-next-line max-len
    if (logger) logger(`loaded image wth *${pxlCount}*pxls to #${canvas.ident},${x},${y} (+*${x}*+\\_+*${y}*+ - +*${x + info.width - 1}*+\\_+*${y + info.height - 1}*+)`);
    return [
      200,
      `Successfully loaded image wth ${pxlCount}pxls to ${x}/${y}`,
    ];
  } catch {
    return [400, 'Can not read image file'];
  }
}

/*
 * register responses on socket for Watch Actions
 */
socketEvents.onReq('watch', (action, ...args) => {
  try {
    if (action === 'getIIDSummary') {
      return getIIDSummary(...args);
    } if (action === 'getIIDPixels') {
      return getIIDPixels(...args);
    } if (action === 'getSummaryFromArea') {
      return getSummaryFromArea(...args);
    } if (action === 'getPixelsFromArea') {
      return getPixelsFromArea(...args);
    }
  } catch {
    // silently fail when file couldn't be parsed
  }
  return null;
});

/*
 * Check who placed on a canvas area
 * @param action if every pixel or summary should be returned
 * @param ulcoor coords of upper-left corner in X_Y format
 * @param brcoor coords of bottom-right corner in X_Y format
 * @param canvasid numerical canvas id as string
 * @return Object with {info, cols, rows}
 */
export async function executeWatchAction(
  action,
  ulcoor,
  brcoor,
  time,
  iid,
  canvasid,
  maxrows,
) {
  if (!canvasid) {
    return { info: 'canvasid not defined' };
  }

  maxrows = parseInt(maxrows, 10);
  if (!maxrows || maxrows < 1) {
    maxrows = 300;
  } else if (maxrows > 10000) {
    maxrows = 10000;
  }

  const ts = parseInt(time, 10);
  const canvas = canvases[canvasid];
  let error = null;
  if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (!action) {
    error = 'No cleanaction given';
  } else if (Number.isNaN(ts)) {
    error = 'Invalid time given';
  }
  if (error) {
    return { info: error };
  }

  let ret;
  if (!ulcoor && !brcoor && iid) {
    if (action === 'summary') {
      ret = await socketEvents.reqAll(
        'watch',
        'getIIDSummary',
        iid,
        time,
      );
    }
    if (action === 'all') {
      ret = await socketEvents.reqAll(
        'watch',
        'getIIDPixels',
        iid,
        time,
        maxrows,
      );
    }
    if (typeof ret === 'string') {
      return { info: ret };
    }
    if (typeof ret !== 'undefined') {
      return ret;
    }
  }

  const parseCoords = validateCoorRange(ulcoor, brcoor, canvas.size);
  if (typeof parseCoords === 'string') {
    return { info: parseCoords };
  }
  const [x, y, u, v] = parseCoords;

  if ((u - x > 1000 || v - y > 1000)
    && Date.now() - ts > 5 * 60 * 1000
    && !iid
  ) {
    return { info: 'Can not watch so many pixels' };
  }

  if (action === 'summary') {
    ret = await socketEvents.reqAll(
      'watch',
      'getSummaryFromArea',
      canvasid,
      x, y, u, v,
      time,
      iid,
    );
  }
  if (action === 'all') {
    ret = await socketEvents.reqAll(
      'watch',
      'getPixelsFromArea',
      canvasid,
      x, y, u, v,
      time,
      iid,
      maxrows,
    );
  }
  if (typeof ret === 'string') {
    return { info: ret };
  }
  if (typeof ret !== 'undefined') {
    return ret;
  }
  return { info: 'Invalid action given' };
}

/*
 * Execute actions for cleaning/filtering canvas
 * @param action what to do
 * @param ulcoor coords of upper-left corner in X_Y format
 * @param brcoor coords of bottom-right corner in X_Y format
 * @param canvasid numerical canvas id as string
 * @return [ret, msg] http status code and message
 */
export async function executeCleanerAction(
  action,
  ulcoor,
  brcoor,
  canvasid,
  logger = null,
) {
  if (!canvasid) {
    return [403, 'canvasid not defined'];
  }
  const canvas = canvases[canvasid];
  let error = null;
  if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (!action) {
    error = 'No cleanaction given';
  }
  if (error) {
    return [403, error];
  }

  const parseCoords = validateCoorRange(ulcoor, brcoor, canvas.size);
  if (typeof parseCoords === 'string') {
    return [403, parseCoords];
  }
  const [x, y, u, v] = parseCoords;

  error = CanvasCleaner.set(canvasid, x, y, u, v, action);
  if (error) {
    return [403, error];
  }
  // eslint-disable-next-line max-len
  const report = `set Canvas Cleaner to *"${action}"* from #${canvas.ident},${x},${y} to #${canvas.ident},${u},${v}`;
  if (logger) logger(report);
  return [200, report];
}

/*
 * Execute actions for protecting areas
 * @param action what to do
 * @param ulcoor coords of upper-left corner in X_Y format
 * @param brcoor coords of bottom-right corner in X_Y format
 * @param canvasid numerical canvas id as string
 * @return [ret, msg] http status code and message
 */
export async function executeProtAction(
  action,
  ulcoor,
  brcoor,
  canvasid,
  logger = null,
) {
  if (!canvasid) {
    return [403, 'canvasid not defined'];
  }
  const canvas = canvases[canvasid];
  let error = null;
  if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (!action) {
    error = 'No imageaction given';
  } else if (action !== 'protect' && action !== 'unprotect') {
    error = 'Invalid action (must be protect or unprotect)';
  }
  if (error !== null) {
    return [403, error];
  }

  const parseCoords = validateCoorRange(ulcoor, brcoor, canvas.size);
  if (typeof parseCoords === 'string') {
    return [403, parseCoords];
  }
  const [x, y, u, v] = parseCoords;

  const width = u - x + 1;
  const height = v - y + 1;
  if (width * height > 10000000) {
    return [403, 'Can not set protection to more than 10m pixels at once'];
  }
  const protect = action === 'protect';
  const pxlCount = await protectCanvasArea(
    canvasid,
    x,
    y,
    width,
    height,
    protect,
  );
  if (logger) {
    logger(
      (protect)
      // eslint-disable-next-line max-len
        ? `protected *${width}*x*${height}* area at #${canvas.ident},${x},${y} with *${pxlCount}*pxls (+*${x}*+\\_+*${y}*+ - +*${u}*+\\_+*${v}*+)`
      // eslint-disable-next-line max-len
        : `unprotect *${width}*x*${height}* area at #${canvas.ident},${x},${y} with *${pxlCount}*pxls (+*${x}*+\\_+*${y}*+ - +*${u}*+\\_+*${v}*+)`,
    );
  }
  return [
    200,
    (protect)
    // eslint-disable-next-line max-len
      ? `Successfully protected ${width}x${height} area at #${canvas.ident},${x},${y} with ${pxlCount}pxls (${ulcoor} - ${brcoor})`
    // eslint-disable-next-line max-len
      : `Successfully unprotected ${width}x${height} area at #${canvas.ident},${x},${y} with ${pxlCount}pxls (${ulcoor} - ${brcoor})`,
  ];
}

/*
 * Execute rollback
 * @param date in format YYYYMMdd
 * @param time in format hhmm
 * @param ulcoor coords of upper-left corner in X_Y format
 * @param brcoor coords of bottom-right corner in X_Y format
 * @param canvasid numerical canvas id as string
 * @return [ret, msg] http status code and message
 */
export async function executeRollback(
  date,
  time,
  ulcoor,
  brcoor,
  canvasid,
  logger = null,
  isAdmin = false,
) {
  if (!canvasid) {
    return [403, 'canvasid not defined'];
  }
  const canvas = canvases[canvasid];
  let error = null;
  if (!canvas) {
    error = 'Invalid canvas selected';
  } else if (!date) {
    error = 'No date given';
  } else if (!time) {
    error = 'No time given';
  } else if (Number.isNaN(Number(date)) || date.length !== 8) {
    error = 'Invalid date';
  } else if (Number.isNaN(Number(time)) || time.length !== 4) {
    error = 'Invalid time';
  }
  if (error !== null) {
    return [403, error];
  }

  const parseCoords = validateCoorRange(ulcoor, brcoor, canvas.size);
  if (typeof parseCoords === 'string') {
    return [403, parseCoords];
  }
  const [x, y, u, v] = parseCoords;

  const width = u - x + 1;
  const height = v - y + 1;
  if (!isAdmin && width * height > 1000000) {
    return [403, 'Can not rollback more than 1m pixels at once'];
  }

  const pxlCount = await rollbackCanvasArea(
    canvasid,
    x,
    y,
    width,
    height,
    date,
    time,
  );
  if (logger) {
    logger(
    // eslint-disable-next-line max-len
      `rolled back to *${date}* for *${width}*x*${height}* area at #${canvas.ident},${x},${y} with *${pxlCount}*pxls (+*${x}*+\\_+*${y}*+ - +*${u}*+\\_+*${v}*+)`,
    );
  }
  return [
    200,
    // eslint-disable-next-line max-len
    `Successfully rolled back to ${date} for ${width}x${height} area at #${canvas.ident},${x},${y} with ${pxlCount}pxls (${ulcoor} - ${brcoor})`,
  ];
}

/*
 * Get list of mods
 * @return [[id1, name2], [id2, name2], ...] list
 */
export async function getModList() {
  const mods = await getUserByUserLvl(USERLVL.MOD);
  if (!mods) {
    return [];
  }
  return mods.map((mod) => [mod.id, mod.name]);
}

export async function removeMod(userId) {
  if (Number.isNaN(userId)) {
    throw new Error('Invalid userId');
  }
  const success = await setUserLvl(userId, USERLVL.REGISTERED);
  if (success) {
    return `Moderation rights removed from user ${userId}`;
  }
  throw new Error('Couldn\'t remove Mod from user');
}

export async function makeMod(name) {
  if (!name) {
    throw new Error('No username given');
  }
  const id = await name2Id(name);
  if (!id) {
    throw new Error(`User ${name} not found`);
  }
  const success = await setUserLvl(id, USERLVL.MOD);
  if (success) {
    return `Made user ${name} ${id} mod`;
  }
  throw new Error('Couldn\'t make user Mod');
}
