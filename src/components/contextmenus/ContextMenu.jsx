/*
 * context menu itself that will be shown inside ContextMenuProvider
 */

import React, { useRef, useEffect, useState } from 'react';

import { useClickOutside } from '../hooks/clickOutside.js';

import UserContextMenu from './UserContextMenu.jsx';
import ChannelContextMenu from './ChannelContextMenu.jsx';
import BanMediaContextMenu from './BanMediaContextMenu.jsx';

const ContextMenu = ({ type, x, y, align, args, active, remove, close }) => {
  const [render, setRender] = useState(false);
  const wrapperRef = useRef(null);

  useClickOutside([wrapperRef], remove);

  useEffect(() => {
    if (active && !render) {
      requestAnimationFrame(() => {
        setRender(true);
      });
    }
  }, [active, render]);

  const style = {
    transition: 'opacity 100ms ease-in-out',
    opacity: active && render ? 1 : 0,
  };
  switch (align) {
    case 'tr': {
      style.right = window.innerWidth - x;
      style.top = y;
      break;
    }
    case 'br': {
      style.right = window.innerWidth - x;
      style.bottom = window.innerHeight - y;
      break;
    }
    case 'bl': {
      style.left = x;
      style.bottom = window.innerHeight - y;
      break;
    }
    default: {
      // also 'tl'
      style.left = x;
      style.top = y;
    }
  }

  let className = 'contextmenu ' + type;
  if (active && render) {
    className += ' show';
  }

  let Content;
  switch (type) {
    case 'USER':
      Content = UserContextMenu;
      break;
    case 'CHANNEL':
      Content = ChannelContextMenu;
      break;
    case 'BANMEDIA':
      Content = BanMediaContextMenu;
      break;
    default:
      return null;
  }

  return (
    <div
      ref={wrapperRef}
      className={`contextmenu ${type}`}
      style={style}
      onTransitionEnd={active ? undefined : close}
    >
      <Content close={close} args={args} />
    </div>
  );
};

export default ContextMenu;
