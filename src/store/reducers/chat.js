import { MAX_CHAT_MESSAGES, CHANNEL_TYPES } from '../../core/constants.js';

const initialState = {
  /*
   * {
   *   cid: [
   *     name,
   *     type,
   *     lastTs,
   *   ],
   *   cid2: [
   *     name,
   *     type,
   *     lastTs,
   *     dmUserId,
   *   ],
   *   ...
   * }
   */
  channels: {},
  // [[uId, userName], [userId2, userName2],...]
  blocked: [],
  /*
   * { cid: [[
   *   name, text, country, userId, ts, msgId, flagLegit, avatarId, attachments
   * ],...], ... }
   *
   * with attachments:
   * [[mediaId, type, size, width, height, avgColor], ...]
   */
  messages: {},
};

export default function chat(
  state = initialState,
  action,
) {
  switch (action.type) {
    case 's/REC_ME':
    case 's/LOGIN': {
      // making sure object keys are numbers
      const channels = {};
      const channelsJson = action.channels;
      const cids = Object.keys(channelsJson);
      for (let i = 0; i < cids.length; i += 1) {
        const cid = cids[i];
        channels[Number(cid)] = channelsJson[cid];
      }
      return {
        ...state,
        channels,
        blocked: action.blocked,
      };
    }

    case 's/LOGOUT': {
      const channels = { ...state.channels };
      const messages = { ...state.messages };
      const keys = Object.keys(channels);
      for (let i = 0; i < keys.length; i += 1) {
        const cid = keys[i];
        if (channels[cid][1] !== 0) {
          delete messages[cid];
          delete channels[cid];
        }
      }
      return {
        ...state,
        channels,
        blocked: [],
        messages,
      };
    }

    case 's/BLOCK_USER': {
      const { userId, userName } = action;
      const blocked = [
        ...state.blocked,
        [userId, userName],
      ];
      /*
       * remove DM channel if exists
       */
      const channels = { ...state.channels };
      const chanKeys = Object.keys(channels);
      for (let i = 0; i < chanKeys.length; i += 1) {
        const cid = chanKeys[i];
        if (channels[cid][1] === 1 && channels[cid][3] === userId) {
          delete channels[cid];
          return {
            ...state,
            channels,
            blocked,
          };
        }
      }
      return {
        ...state,
        blocked,
      };
    }

    case 's/UNBLOCK_USER': {
      const { userId } = action;
      const blocked = state.blocked.filter((bl) => (bl[0] !== userId));
      return {
        ...state,
        blocked,
      };
    }

    case 's/ADD_CHAT_CHANNEL': {
      const { channel } = action;
      const cid = Number(Object.keys(channel)[0]);
      if (state.channels[cid]) {
        return state;
      }
      return {
        ...state,
        channels: {
          ...state.channels,
          ...channel,
        },
      };
    }

    case 's/REMOVE_CHAT_CHANNEL': {
      const { cid } = action;
      if (!state.channels[cid]) {
        return state;
      }
      const channels = { ...state.channels };
      const messages = { ...state.messages };
      delete messages[cid];
      delete channels[cid];
      return {
        ...state,
        channels,
        messages,
      };
    }

    case 's/REC_CHAT_MESSAGE': {
      const { cid, messageArray } = action;
      if (!state.messages[cid] || !state.channels[cid]) {
        return state;
      }
      console.log('REC CHAT', messageArray);
      const messages = {
        ...state.messages,
        [cid]: [
          ...state.messages[cid],
          messageArray,
        ],
      };
      if (messages[cid].length > MAX_CHAT_MESSAGES) {
        messages[cid].splice(0, 2);
      }

      /*
       * update timestamp of last message
       */
      const channelArray = [...state.channels[cid]];
      channelArray[2] = Date.now();

      return {
        ...state,
        channels: {
          ...state.channels,
          [cid]: channelArray,
        },
        messages,
      };
    }

    case 's/DELETE_PUB_USR_MSG': {
      const { user } = action;

      const messages = {
        ...state.messages,
      };

      const cids = Object.keys(state.channels);
      for (let i = 0; i < cids.length; i += 1) {
        const cid = cids[i];
        if (state.channels[cid][1] === CHANNEL_TYPES.PUBLIC && messages[cid]) {
          messages[cid] = messages[cid].filter((m) => m[3] !== user);
        }
      }

      return {
        ...state,
        messages,
      };
    }

    case 's/REC_CHAT_HISTORY': {
      const { cid, history } = action;
      return {
        ...state,
        messages: {
          ...state.messages,
          [cid]: history,
        },
      };
    }

    default:
      return state;
  }
}
