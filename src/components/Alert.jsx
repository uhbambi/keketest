/*
 *
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import GlobalCaptcha from './GlobalCaptcha.jsx';
import BanInfo from './BanInfo.jsx';
import Overlay from './Overlay.jsx';
import RefreshPrompt from './RefreshPrompt.jsx';
import { closeAlert } from '../store/actions/index.js';
import { parse } from '../core/MarkdownParser.js';
import { Markdown } from './Markdown.jsx';

const Alert = () => {
  const [render, setRender] = useState(false);

  const {
    open,
    alertType,
    title,
    message,
    btn,
  } = useSelector((state) => state.alert);

  const dispatch = useDispatch();
  const close = useCallback(() => {
    dispatch(closeAlert());
  }, [dispatch]);

  useEffect(() => {
    if (open) {
      window.setTimeout(() => {
        setRender(true);
      }, 10);
    }
  }, [open]);

  const mdArray = useMemo(
    () => parse(message, { parseLinks: true }), [message],
  );

  let Content = null;
  switch (alertType) {
    case 'captcha':
      Content = GlobalCaptcha;
      break;
    case 'ban':
      Content = BanInfo;
      break;
    case 'refresh':
      Content = RefreshPrompt;
      break;
    default:
      // nothing
  }

  if (!render && !open) {
    return null;
  }

  const show = open && render;

  return (
    <>
      <Overlay
        z={6}
        show={show}
        onClick={close}
      />
      <div
        className={(show) ? 'Alert show' : 'Alert'}
        onTransitionEnd={() => {
          if (!open) setRender(false);
        }}
      >
        <h2>{title}</h2>
        {(message) && (
          <Markdown mdArray={mdArray} />
        )}
        {(Content) ? (
          <Content close={close} />
        ) : (
          <button type="button" onClick={close}>{btn}</button>
        )}
      </div>
      )
    </>
  );
};

export default React.memo(Alert);
