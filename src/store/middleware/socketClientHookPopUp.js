/*
 * Hooks for websocket client for popup window
 *
 */
import { shallowEqual } from 'react-redux';

import SocketClient from '../../socket/SocketClient.js';
import { POPUPS_NEEDING_WS } from '../../core/constants.js';
import { parentExists } from '../../core/utils.js';

export default (store) => (next) => (action) => {
  if (SocketClient.readyState === WebSocket.CLOSED) {
    if ((
      action.type === 't/PARENT_CLOSED'
      || action.type === 'CHANGE_WIN_TYPE'
      || action.type === 'HYDRATED'
    ) && !parentExists()
      && POPUPS_NEEDING_WS.includes(store.getState().popup.windowType)
    ) {
      SocketClient.initialize(store);
    }
  } else {
    switch (action.type) {
      case 's/SET_NAME':
      case 's/LOGIN':
      case 's/LOGOUT': {
        SocketClient.reconnect();
        break;
      }

      case 's/REQ_CHAT_MESSAGE': {
        const {
          text,
          channel,
        } = action;
        SocketClient.sendChatMessage(text, channel);
        break;
      }

      case 's/REG_CHAT_CHAN':
      case 's/DEREG_CHAT_CHAN': {
        const prevState = Object.keys(store.getState().chat.channelViews);
        const ret = next(action);
        const state = Object.keys(store.getState().chat.channelViews);
        if (!shallowEqual(prevState, state)) {
          SocketClient.sendChatView();
        }
        return ret;
      }

      default:
      // nothing
    }
  }

  return next(action);
};
