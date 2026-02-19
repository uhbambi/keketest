/*
 * media bans
 */
import { ban } from '../../core/ban.js';
import { hasMediaBan } from '../../data/sql/MediaBan.js';
import { MEDIA_BAN_REASONS } from '../../core/constants.js';

/**
 * check if media file is allowed
 * @param filePath path of file
 * @param hash sha265 hash of file
 * @param [phash] perceptive hash of image
 * @param [user] user object from middleware
 * @param [ip] ip object from middleware
 */
export default async function checkIfBanned(filePath, hash, pHash, user, ip) {
  const reason = await hasMediaBan(hash, pHash);
  if (reason === MEDIA_BAN_REASONS.CSAM) {
    await ban(ip.ipString, user.id, null, true, true, 'Posting CSAM');
    /**
     * TODO: automatically report to authorities
     */
  }
  return reason;
}
