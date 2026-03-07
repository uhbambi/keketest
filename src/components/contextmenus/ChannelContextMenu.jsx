/*
 *
 */

import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import { toggleChatCompact } from '../../store/actions/index.js';
import { setLeaveChannel, setChannelMute } from '../../store/actions/thunks.js';
import { CHANNEL_TYPES } from '../../core/constants.js';

/*
 * args: {
 *   cid, type, muted,
 * }
 */
const ChannelContextMenu = ({ args, close }) => {
  const chatCompact = useSelector((state) => state.gui.chatCompact);
  const fetching = useSelector((state) => state.fetching.fetchingApi);
  const [muted, setMuted] = useState(args.muted);

  const { cid, type } = args;
  const dispatch = useDispatch();

  return (
    <>
      {(type !== CHANNEL_TYPES.PUBLIC)
        && (
          <React.Fragment key="dmc">
            <div
              role="button"
              key="mute"
              onClick={async () => {
                if (!fetching) {
                  const success = await dispatch(setChannelMute(cid, !muted));
                  if (success) {
                    setMuted(!muted);
                  }
                }
              }}
              tabIndex={0}
            >
              {`${(muted) ? '✔' : '✘'} ${t`Mute Channel`}`}
            </div>
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
          </React.Fragment>
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
