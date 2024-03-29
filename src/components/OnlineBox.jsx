/**
 *
 */

import React from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { FaUser, FaPaintBrush, FaFlipboard } from 'react-icons/fa';
import { t } from 'ttag';

import { toggleOnlineCanvas, toggleNoRound } from '../store/actions';
import { numberToString, numberToStringFull } from '../core/utils';


const OnlineBox = () => {
  const [
    online,
    totalPixels,
    name,
    onlineCanvas,
    noRound,
    canvasId,
  ] = useSelector((state) => [
    state.ranks.online,
    state.ranks.totalPixels,
    state.user.name,
    state.gui.onlineCanvas,
    state.gui.noRound,
    state.canvas.canvasId,
  ], shallowEqual);
  const dispatch = useDispatch();

  return (
    <div
      className="onlinebox"
    >
      {(onlineCanvas)
        ? (
          <span
            title={t`Online Users on Canvas`}
            role="button"
            tabIndex="0"
            key="onlinec"
            onClick={() => dispatch(toggleOnlineCanvas())}
          >
            {online[canvasId] || 0}<FaUser /><FaFlipboard />
          </span>
        )
        : (
          <span
            role="button"
            tabIndex="0"
            key="onlinec"
            onClick={() => dispatch(toggleOnlineCanvas())}
            title={t`Total Online Users`}
          >
            {online.total}<FaUser />
          </span>
        )}
       &nbsp;
      {(name != null)
          && (
          <span
            role="button"
            tabIndex="0"
            key="onlinec"
            onClick={() => dispatch(toggleNoRound())}
            title={t`Pixels placed`}
          >
            {(noRound)
              ? numberToStringFull(totalPixels) : numberToString(totalPixels)}
            <FaPaintBrush />
          </span>
          )}
    </div>
  );
};

export default React.memo(OnlineBox);
