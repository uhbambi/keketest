/*
 * change faction settings
 *
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import {
  validateFactionTitle, validateFactionName,
} from '../../utils/validation.js';
import {
  getFactionLvlOfUser, getAllMembersOfFaction,
  setFlagOfFaction, setFactionProperty, setFactionAvatar,
} from '../../data/sql/Faction.js';
import { getMediaType } from '../../data/sql/Media.js';
import { FACTIONLVL, FACTION_FLAGS } from '../../core/constants.js';

async function userfactionchange(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { gettext, t }, user, body: factionData } = req;
  const { fid, isPrivate, isPublic, avatarId } = factionData;

  if (!fid || typeof fid !== 'string') {
    throw new Error('No faction given');
  }

  const { sqlFId, powerlvl } = await getFactionLvlOfUser(user.id, fid);
  if (!sqlFId) {
    throw new Error('This faction does not exist');
  }
  if (!powerlvl || powerlvl < FACTIONLVL.MAGISTRATE) {
    throw new Error('Insufficient permissions on this faction');
  }

  let { name, title, description } = factionData;

  let changed = false;
  const factionChanges = {};

  if (typeof isPrivate === 'boolean') {
    changed = true;
    factionChanges.isPrivate = isPrivate;
    const success = await setFlagOfFaction(
      user.id, fid, FACTION_FLAGS.PRIV, isPrivate,
    );
    if (!success) {
      throw new Error('Could not set this factions private property');
    }
    logger.info(
      `User ${user.username} changed faction ${fid} private to ${isPrivate}`,
    );
  }

  if (typeof isPublic === 'boolean') {
    changed = true;
    factionChanges.isPublic = isPublic;
    const success = await setFlagOfFaction(
      user.id, fid, FACTION_FLAGS.PUBLIC, isPublic,
    );
    if (!success) {
      throw new Error('Could not set this factions public property');
    }
    logger.info(
      `User ${user.username} changed faction ${fid} private to ${isPublic}`,
    );
  }

  if (typeof name === 'string') {
    changed = true;

    name = name.toLowerCase();
    const error = validateFactionName(name);
    if (error) {
      throw new Error(gettext(error));
    }
    factionChanges.name = name;
    const success = await setFactionProperty(sqlFId, 'name', name);
    if (!success) {
      throw new Error(t`Name already in use.`);
    }
    logger.info(
      `AUTH: Changed factions name for  ${fid} to ${name} by ${user.id}`,
    );
  }

  if (typeof title === 'string') {
    changed = true;

    title = title.trim();
    const error = validateFactionTitle(title);
    if (error) {
      throw new Error(gettext(error));
    }
    factionChanges.title = title;
    const success = await setFactionProperty(sqlFId, 'title', title);
    if (!success) {
      throw new Error('Title could not be set.');
    }
    logger.info(
      `AUTH: Changed factions title for  ${fid} to ${title} by ${user.id}`,
    );
  }

  if (typeof description === 'string') {
    changed = true;

    description = description.trim();
    if (description.length > 1000) {
      throw new Error(t`Description must be shorter than 1000 characters`);
    }
    factionChanges.description = description;
    const success = await setFactionProperty(
      sqlFId, 'description', description,
    );
    if (!success) {
      throw new Error('Description could not be set.');
    }
    logger.info(
      // eslint-disable-next-line max-len
      `AUTH: Changed factions description for ${fid} to ${description} by ${user.id}`,
    );
  }

  if (typeof avatarId === 'string') {
    changed = true;
    factionChanges.avatarId = avatarId;
    const isLegitMedia = await getMediaType(avatarId) === 'image';
    if (!isLegitMedia) {
      throw new Error(t`Avatar can only be an image`);
    }
    const success = await setFactionAvatar(sqlFId, avatarId);
    if (!success) {
      throw new Error(t`Could not this factions avatar`);
    }
    logger.info(`User ${user.id} changed faction ${fid} avatar to ${avatarId}`);
  }

  if (!changed) {
    throw new Error('You did not define anything to change');
  }

  const affectedUserIds = await getAllMembersOfFaction(sqlFId);
  if (affectedUserIds.length) {
    const changedKeys = Object.keys(factionChanges);
    for (let i = 0; i < changedKeys.length; i += 1) {
      const key = changedKeys[i];
      const value = factionChanges[key];
      socketEvents.patchUserState(affectedUserIds, 'profile', {
        op: 'setex',
        path: `factions[fid:${fid}].${key}`,
        value,
      });
    }
  }

  res.json({
    status: 'ok',
  });
}

export default userfactionchange;
