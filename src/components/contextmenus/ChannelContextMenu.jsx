/*
 *
 */

import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import {
  muteChatChannel,
  unmuteChatChannel,
  toggleChatCompact,
} from '../../store/actions/index.js';
import {
  setLeaveChannel,
} from '../../store/actions/thunks.js';

/*
 * args: {
 *   cid,
 * }
 */
const ChannelContextMenu = ({ args, close }) => {
  const channels = useSelector((state) => state.chat.channels);
  const muteArr = useSelector((state) => state.chatRead.mute);
  const chatCompact = useSelector((state) => state.gui.chatCompact);

  const { cid } = args;
  const dispatch = useDispatch();

  const isMuted = muteArr.includes(cid);

  return (
    <>
      <div
        role="button"
        key="mute"
        onClick={() => {
          if (isMuted) {
            dispatch(unmuteChatChannel(cid));
          } else {
            dispatch(muteChatChannel(cid));
          }
        }}
        tabIndex={0}
      >
        {`${(isMuted) ? '✔' : '✘'} ${t`Mute Channel`}`}
      </div>
      {(channels[cid][1] !== 0)
        && (
        <div
          key="leave"
          role="button"
          onClick={() => {
            dispatch(setLeaveChannel(cid));
            close();
          }}
          tabIndex={0}
        >
          {t`Close`}
        </div>
        )}
      <div
        role="button"
        key="style"
        onClick={() => dispatch(toggleChatCompact())}
        tabIndex={0}
      >
        {`${(chatCompact) ? '✔' : '✘'} ${t`Compact Chat`}`}
      </div>
    </>
  );
};

export default React.memo(ChannelContextMenu);
