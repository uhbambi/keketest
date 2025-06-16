/*
 * wraper for ban that notices websocket for updates
 */
import { ban as banQuery, unban as unbanQuery } from '../data/sql/Ban';
import socketEvents from '../socket/socketEvents';

/**
 * notice sockets that users / ips changed
 * @param userIds Array of user ids
 * @param ipStrings Array of ipStrings
 */
function notifyUserIpChanges(userIds, ipStrings) {
  if (userIds) {
    if (Array.isArray(userIds)) {
      userIds.forEach((id) => socketEvents.reloadUser(id));
    } else {
      socketEvents.reloadUser(userIds);
    }
  }
  if (ipStrings) {
    if (Array.isArray(ipStrings)) {
      ipStrings.forEach((ipString) => socketEvents.reloadIP(ipString, true));
    } else {
      socketEvents.reloadIP(ipStrings, true);
    }
  }
}

/**
 * ban
 * @param userIds Array of user ids
 * @param ipStrings Array of ipStrings
 * @param mute boolean if muting
 * @param ban boolean if banning
 * @param reason reasoning as string
 * @param duration duration in seconds
 * @param muid id of the mod that bans
 */
export async function ban(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, mute, ban, reason, ...args
) {
  if ((!mute && !ban) || !reason) {
    return false;
  }
  const result = await banQuery(ipStrings, userIds, mute, ban, reason, ...args);
  notifyUserIpChanges(userIds, ipStrings);
  return result;
}


/**
 * unban by user and/or ip
 * @param userIds Array of user ids
 * @param ipStrings Array of ipStrings
 * @param mute boolean if unmuting
 * @param ban boolean if unbanning
 * @param muid id of the mod that bans
 * @return boolean success
 */
export async function unban(
  // eslint-disable-next-line no-shadow
  ipStrings, userIds, mute, ban, ...args
) {
  if (!mute && !ban) {
    return 0;
  }
  const result = await unbanQuery(ipStrings, userIds, mute, ban, ...args);
  notifyUserIpChanges(userIds, ipStrings);
  return result;
}
