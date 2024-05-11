/**
 *
 */

import React from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';

import {
  hideAllWindowTypes,
  openWindow,
} from '../../store/actions/windows';

const selectPlayerWindowStatus = (state) => [
  state.windows.windows.some((win) => win.windowType === 'PLAYER'
  && win.hidden === false && (state.windows.showWindows || win.fullscreen)),
  state.windows.windows.some((win) => win.windowType === 'PLAYER'
  && win.hidden === true) && state.windows.showWindows,
];

const ESCButton = () => {
  const dispatch = useDispatch();

  const [playerOpen, playerHidden] = useSelector(
    selectPlayerWindowStatus,
    shallowEqual,
  );

  return (
    <div
      style={{
        position: 'absolute',
        bottom: 4,
        left: '50%',
        marginLeft: -27,
        width: 150,
        maxWidth: '50%',
      }}
      role="button"
      title="Watch the Eurovision Song Contest 2024"
      tabIndex={0}
      onClick={() => {
        if (playerOpen) {
          dispatch(hideAllWindowTypes('PLAYER', true));
        } else if (playerHidden) {
          dispatch(hideAllWindowTypes('PLAYER', false));
        } else {
          dispatch(openWindow(
            'PLAYER',
            'Eurovision Song Contest',
            { uri: 'https://www.youtube.com/watch?v=ckGRHJ-J9G4' },
            false,
            true,
            (window.innerWidth - 480) / 2,
            (window.innerHeight - 270) / 2,
            480,
            270,
          ));
        }
      }}
    >
      <img
        alt="Eurovision Songonctest"
        style={{
          background: '#ffffffe3', cursor: 'pointer',
        }}
        src="esc.svg"
      />
    </div>
  );
};

export default ESCButton;
