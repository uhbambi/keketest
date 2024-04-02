/**
 */

// canvas size (width and height) MUST be 256 * 4^n to be able to stick
// to established tiling conventions.
// (basically by sticking to that, we keep ourself many options open for the future)
// see OSM tiling: https://wiki.openstreetmap.org/wiki/Slippy_map_tilenames
export const MAX_SCALE = 40; // 52 in log2
// export const DEFAULT_SCALE = 0.25; //-20 in log2
export const DEFAULT_SCALE = 3;

// background color behind 2D canvses
export const BACKGROUND_CLR_HEX = '#C4C4C4';

export const DEFAULT_CANVAS_ID = '0';

export const TILE_LOADING_IMAGE = './loading.png';

// constants for 3D voxel canvas
export const THREE_CANVAS_HEIGHT = 128;
export const THREE_TILE_SIZE = 32;
// 2D tile size
export const TILE_SIZE = 256;
// how much to scale for a new tiled zoomlevel
export const TILE_ZOOM_LEVEL = 2;

export const COOKIE_SESSION_NAME = 'ppfun.session';

export const SECOND = 1000;
export const MINUTE = 60 * SECOND;
export const HOUR = 60 * MINUTE;
export const DAY = 24 * HOUR;
export const MONTH = 30 * DAY;

// available public Chat Channels
// at least 'en' and 'int' have to be present,
// as they get used in core/ChatProvider
export const CHAT_CHANNELS = [
  {
    name: 'en',
  }, {
    name: 'int',
  }, {
    name: 'art',
  },
];

export const MAX_CHAT_MESSAGES = 100;

export const EVENT_USER_NAME = 'event';
export const INFO_USER_NAME = 'info';
export const APISOCKET_USER_NAME = 'apisocket';

// delay for updating coordinates (for window title, history, url, etc.)
export const VIEW_UPDATE_DELAY = 1000;

// maximum chunks to subscribe to
export const MAX_LOADED_CHUNKS = 2000;
export const MAX_CHUNK_AGE = 300000;
export const GC_INTERVAL = 300000;

// TINYINT (-128 - 127)
export const USERLVL = {
  ANONYM: 0,
  REGISTERED: 10,
  VERIFIED: 20,
  MOD: 80,
  ADMIN: 100,
};

export const OATUH_PROVIDERS = {
  DISCORD: 1,
  REDDIT: 2,
  FACEBOOK: 3,
  GOOGLE: 4,
  VK: 5,
};

export const CHANNEL_TYPES = {
  PUBLIC: 0,
  DM: 1,
  GROUP: 2,
  FACTION: 3,
};

export const RANGEBAN_REASONS = {
  DATACENTER: 0,
  VPN: 0,
  SPAMMING: 1,
  FLOODING: 2,
  SCRAPPING: 3,
  GLOWY: 4,
};
// Mode for shift-painting or phone pencil, HISTORY has to be last
export const PENCIL_MODE = {
  COLOR: 0,
  OVERLAY: 1,
  HISTORY: 2,
};

// threshold at which zoomlevel overlay switches to small-pixel mode
export const OVERLAY_SP_TH = 8;
