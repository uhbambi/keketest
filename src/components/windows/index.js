import { t } from 'ttag';

import Help from './Help.jsx';
import Settings from './Settings.jsx';
import UserArea from './UserArea.jsx';
import CanvasSelect from './CanvasSelect.jsx';
import Archive from './Archive.jsx';
import Chat from './Chat.jsx';
import Player from './Player.jsx';
import FishDisplay from './FishDisplay.jsx';
import BadgeDisplay from './BadgeDisplay.jsx';

export default {
  HELP: [Help, t`Help`],
  SETTINGS: [Settings, t`Settings`],
  USERAREA: [UserArea, t`User Area`],
  CHAT: [Chat, t`Chat`],
  CANVAS_SELECTION: [CanvasSelect, t`Canvas Selection`],
  ARCHIVE: [Archive, t`Canvas Archive`],
  PLAYER: [Player, t`Player`],
  FISH_DISPLAY: [FishDisplay, t`Fish Display`],
  BADGE_DISPLAY: [BadgeDisplay, t`Badge Display`],
  /* other windows */
};

/*
 * NOTE:
 * set windows that should be accessible via popup / url
 * also in ../../core/constants.js
 */
