/*
 * create a faction
 */
import logger from '../../core/logger.js';
import socketEvents from '../../socket/socketEvents.js';
import {
  validateFactionName, validateFactionTitle, validateDescription,
} from '../../utils/validation.js';
import {
  checkIfFactionExists, getFactionsAmountOfUser, createFaction,
} from '../../data/sql/Faction.js';
import { getMediaType } from '../../data/sql/Media.js';
import {
  MAX_FACTIONS_PER_USER, MAX_OWNED_FACTIONS_PER_USER,
} from '../../core/constants.js';

export default async function factioncreate(req, res) {
  req.tickRateLimiter(7000);
  const { ttag: { gettext, t }, user, body: factionData } = req;
  const { avatarId } = factionData;
  let {
    isPrivate, isPublic,
    name, title, description,
  } = factionData;

  name = name?.toLowerCase();
  title = title?.trim();
  description = description?.trim();
  isPrivate = !!isPrivate;
  isPublic = !!isPublic;

  const errors = [];
  let error = gettext(validateFactionName(name));
  if (error) errors.push(error);
  error = gettext(validateFactionTitle(title));
  if (error) errors.push(error);
  error = gettext(validateDescription(description));
  if (error) errors.push(error);
  if (typeof avatarId !== 'string') {
    errors.push(t`No Avatar given`);
  }

  if (!errors.length) {
    const exists = await checkIfFactionExists(name);
    if (exists) {
      errors.push(t`Name already in use.`);
    }
  }

  if (!errors.length) {
    const isLegitMedia = await getMediaType(avatarId) === 'image';
    if (!isLegitMedia) {
      errors.push(t`Avatar can only be an image`);
    }
  }

  if (!errors.length) {
    const [amountTotal, amountOwned] = await getFactionsAmountOfUser(user.id);
    if (amountTotal >= MAX_FACTIONS_PER_USER) {
      errors.push(
        t`You can only have ${MAX_FACTIONS_PER_USER} factions in total`,
      );
    }
    if (amountOwned >= MAX_OWNED_FACTIONS_PER_USER) {
      errors.push(
        // eslint-disable-next-line max-len
        t`You can only be owner of ${MAX_OWNED_FACTIONS_PER_USER} factions in total`,
      );
    }
  }

  if (errors.length) {
    res.status(400).json({ errors });
  }

  const model = await createFaction(
    user.id, name, title, description, isPrivate, isPublic, avatarId,
  );
  if (!model) {
    throw new Error('Could not create faction');
  }

  const profilePatch = {
    op: 'push',
    path: 'factions',
    value: model,
  };
  socketEvents.patchUserState(user.id, 'profile', profilePatch);

  logger.info(`User ${user.id} created new faction ${name}`);
  res.json({
    status: 'ok',
    profilePatch,
  });
}
