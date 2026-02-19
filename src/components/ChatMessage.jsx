import React from 'react';
import { useSelector } from 'react-redux';

import MdParagraph from './markdown/MdParagraph.jsx';
import Avatar from './Avatar.jsx';
import {
  colorFromText, setBrightness, getDateTimeString,
} from '../core/utils.js';
import { selectIsDarkMode } from '../store/selectors/gui.js';
import { cdn } from '../utils/utag.js';


function ChatMessage({
  name,
  uid,
  country,
  msg,
  ts,
  flagLegit,
  avatarId,
  openCm,
}) {
  const isDarkMode = useSelector(selectIsDarkMode);

  const isInfo = (name === 'info');
  const isEvent = (name === 'event');

  let className = 'msg';
  if (isInfo) {
    className += ' info';
  } else if (isEvent) {
    className += ' event';
  } else if (msg.charAt(0) === '>') {
    className += ' greentext';
  } else if (msg.charAt(0) === '<') {
    className += ' redtext';
  }

  let flagClass = 'chatflag';
  if (!flagLegit) {
    flagClass += ' illegit';
  }

  if (isInfo || isEvent) {
    return (
      <li className="chatmsg">
        <div className="avatar" />
        <div className="msgcontent">
          <MdParagraph text={msg} className={className} />
        </div>
      </li>
    );
  }

  return (
    <li className="chatmsg">
      <Avatar uid={uid} isDarkMode={isDarkMode} avatarId={avatarId} />
      <div className="msgcontent">
        <div className="msgheader">
          <span
            key="name"
            role="button"
            tabIndex={-1}
            className="msgheaderuser"
            style={{
              cursor: 'pointer',
            }}
            onClick={(event) => {
              openCm(event.clientX, event.clientY, name, uid);
            }}
          >
            <img
              className={flagClass}
              alt=""
              title={country}
              src={cdn`/cf/${country}.gif`}
            />
            <span
              className="chatname"
              style={{
                color: setBrightness(colorFromText(name), isDarkMode),
              }}
              title={name}
            >
              {name}
            </span>
            {': '}
          </span>
          <span className="chatts">
            {getDateTimeString(ts)}
          </span>
        </div>
        <MdParagraph text={msg} className={className} />
      </div>
    </li>
  );
}

export default React.memo(ChatMessage);
