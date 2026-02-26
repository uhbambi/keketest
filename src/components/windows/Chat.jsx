/**
 *
 */

import React, {
  useRef, useLayoutEffect, useState, useEffect, useCallback, useContext,
} from 'react';
import useStayScrolled from 'react-stay-scrolled';
import { useSelector, useDispatch } from 'react-redux';
import { t } from 'ttag';

import WindowContext from '../context/window.js';
import ContextMenuContext from '../context/contextmenu.js';
import useLink from '../hooks/link.js';
import ChatMessage from '../ChatMessage.jsx';
import FileUpload from '../FileUpload.jsx';
import ChannelDropDown from '../contextmenus/ChannelDropDown.jsx';
import { CHANNEL_TYPES } from '../../core/constants.js';
import { escapeMd } from '../../core/utils.js';

import {
  markChannelAsRead,
  sendChatMessage,
} from '../../store/actions/index.js';
import { receiveChatMessage } from '../../store/actions/socket.js';
import { fetchChatMessages } from '../../store/actions/thunks.js';


const Chat = () => {
  const listRef = useRef();
  const targetRef = useRef();
  const inputRef = useRef();
  const uploadRef = useRef();
  const scrollRef = useRef();
  const waitingForUpload = useRef();

  const [blockedIds, setBlockedIds] = useState([]);
  const [btnSize, setBtnSize] = useState(20);

  const dispatch = useDispatch();

  const ownName = useSelector((state) => state.user.name);
  const fetching = useSelector((state) => state.fetching.fetchingChat);
  const chatCompact = useSelector((state) => state.gui.chatCompact);
  const { channels, messages, blocked } = useSelector((state) => state.chat);

  const { args, setArgs, setTitle } = useContext(WindowContext);
  const showContextMenu = useContext(ContextMenuContext);

  const chatChannel = args.chatChannel || 0;

  const link = useLink();

  const setChannel = useCallback((cid) => {
    dispatch(markChannelAsRead(cid));
    setArgs({
      chatChannel: Number(cid),
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispatch]);

  const printWarnings = useCallback((warnings) => {
    warnings.forEach((warning) => {
      dispatch(receiveChatMessage(
        chatChannel, 'info', warning, 'xx', 0, Math.floor(Date.now() / 1000),
        0, false, null, [],
      ));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatChannel]);

  const addToInput = useCallback((msg) => {
    const inputElem = inputRef.current;
    if (!inputElem) {
      return;
    }
    let newInputMessage = inputElem.value;
    if (newInputMessage.slice(-1) !== ' ') {
      newInputMessage += ' ';
    }
    newInputMessage += `${msg} `;
    inputElem.value = newInputMessage;
    inputRef.current.focus();
  }, []);

  const openUserCm = useCallback((x, y, name, uid) => {
    showContextMenu(
      'USER', x, y, { name, uid, setChannel, addToInput },
    );
  }, [setChannel, addToInput, showContextMenu]);

  const { stayScrolled } = useStayScrolled(listRef, {
    initialScroll: Infinity,
  });

  const channelMessages = messages[chatChannel] || [];
  useEffect(() => {
    if (channels[chatChannel] && !messages[chatChannel] && !fetching) {
      dispatch(fetchChatMessages(chatChannel));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, messages, chatChannel, fetching]);

  useEffect(() => {
    if (channels[chatChannel]) {
      const channelName = channels[chatChannel][0];
      setTitle(`${t`Channel`}: ${channelName}`);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chatChannel, channels]);

  useLayoutEffect(() => {
    stayScrolled();
  }, [channelMessages.length, stayScrolled]);

  useEffect(() => {
    scrollRef.current = stayScrolled;
  }, [stayScrolled]);

  useEffect(() => {
    setTimeout(() => {
      const fontSize = Math.round(targetRef.current.offsetHeight / 10);
      setBtnSize(Math.min(28, fontSize));
    }, 330);
  }, [targetRef]);

  useEffect(() => {
    const bl = [];
    for (let i = 0; i < blocked.length; i += 1) {
      bl.push(blocked[i][0]);
    }
    setBlockedIds(bl);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [blocked.length]);

  async function handleSubmit(evt) {
    evt.preventDefault();
    if (waitingForUpload.current) {
      return;
    }
    waitingForUpload.current = true;

    try {
      let inptMsg = inputRef.current.value.trim();
      // if there are files to upload, do that and add links to them
      const files = await uploadRef.current?.();
      if (files.length) {
        const attachments = files.map(
          // eslint-disable-next-line max-len
          (i) => `$[${escapeMd(i.name)}](${i.shortId}:${i.extension})`,
        ).join(' ');
        if (attachments) {
          inptMsg = `${inptMsg} ${attachments}`;
        }
      }
      if (!inptMsg) {
        return;
      }
      // send message via websocket
      dispatch(sendChatMessage(inptMsg, chatChannel));
      inputRef.current.value = '';
    } finally {
      waitingForUpload.current = false;
    }
  }

  /*
   * if selected channel isn't in channel list anymore
   * for whatever reason (left faction etc.)
   * set channel to first available one
   */
  useEffect(() => {
    if (!chatChannel || !channels[chatChannel]) {
      let chosenChannel;
      for (const [cid, [name, type]] of Object.entries(channels)) {
        if (!chosenChannel) {
          chosenChannel = cid;
        }
        if (type === CHANNEL_TYPES.PUBLIC) {
          chosenChannel = cid;
          if (name === 'en') {
            chosenChannel = cid;
            break;
          }
        }
      }
      if (chosenChannel) {
        setChannel(chosenChannel);
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [channels, chatChannel]);

  return (
    <div
      ref={targetRef}
      className="chat-container"
      // key={chatChannel}
    >
      <ul
        className="chatarea"
        ref={listRef}
        style={{ flexGrow: 1 }}
        role="presentation"
      >
        {(!channelMessages.length) && (
          <ChatMessage
            key="initm"
            uid={0}
            name="info"
            country="xx"
            msg={t`Start chatting here`}
          />
        )}
        {
          channelMessages.map((message) => (
            (!blockedIds.includes(message[3])) && (
              <ChatMessage
                name={message[0]}
                msg={message[1]}
                country={message[2]}
                uid={message[3]}
                ts={message[4]}
                msgId={message[5]}
                flagLegit={message[6]}
                avatarId={message[7]}
                attachments={message[8]}
                key={message[5]}
                openCm={openUserCm}
                scrollRef={scrollRef}
                compact={chatCompact}
              />
            )))
        }
      </ul>
      <div
        className="chatinput"
        key="iptfl"
        style={{
          display: 'flex',
        }}
      >
        {(ownName) ? (
          <React.Fragment key="iptfr">
            <input
              key="iptre"
              style={{
                flexGrow: 1,
                minWidth: 40,
              }}
              ref={inputRef}
              onKeyDown={(evt) => {
                if (evt.key === 'Enter') {
                  handleSubmit(evt);
                }
              }}
              autoComplete="off"
              maxLength="200"
              type="text"
              className="chtipt"
              placeholder={t`Chat here`}
            />
            <FileUpload
              key="fui"
              maxFiles={3}
              uploadRef={uploadRef}
              printErrors={printWarnings}
            />
            <button
              className="sendbtn"
              style={{ flexGrow: 0, width: 32 }}
              type="button"
              onClick={handleSubmit}
            >
              ‣
            </button>
          </React.Fragment>
        ) : (
          <div
            className="modallink"
            key="nlipt"
            onClick={(evt) => {
              evt.stopPropagation();
              link('USERAREA', { target: 'parent' });
            }}
            style={{
              textAlign: 'center',
              fontSize: 13,
              flexGrow: 1,
            }}
            role="button"
            tabIndex={0}
          >
            {t`You must be logged in to chat`}
          </div>
        )}
        <ChannelDropDown
          key="cdd"
          setChatChannel={setChannel}
          chatChannel={chatChannel}
        />
      </div>
      <div
        className="chatlink"
        style={{
          fontSize: btnSize,
        }}
      >
        <span
          onClick={(evt) => {
            showContextMenu(
              'CHANNEL', evt.clientX, evt.clientY, { cid: chatChannel }, 'tr',
            );
          }}
          role="button"
          title={t`Channel settings`}
          tabIndex={-1}
        >⚙</span>
      </div>
    </div>
  );
};

export default Chat;
