/**
 *
 */

import React from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';
import { TbPencil, TbPencilMinus } from 'react-icons/tb';
import { t } from 'ttag';

import { PENCIL_MODE } from '../../core/constants';
import { setHoldPaint } from '../../store/actions';

const PencilButton = () => {
  const [
    holdPaint,
    pencilMode,
    showMvmCtrls,
  ] = useSelector((state) => [
    state.gui.holdPaint,
    state.gui.pencilMode,
    state.gui.showMvmCtrls,
  ], shallowEqual);
  const dispatch = useDispatch();

  let className = 'actionbuttons';
  let title = t`Enable Pencil`;
  if (holdPaint) {
    switch (pencilMode) {
      case PENCIL_MODE.COLOR:
        className += ' ppencil pressed';
        title = t`Disable Pencil`;
        break;
      case PENCIL_MODE.HISTORY:
        className += ' phistory pressed';
        title = t`Disable History Pencil`;
        break;
      case PENCIL_MODE.OVERLAY:
        className += ' poverlay pressed';
        title = t`Disable Overlay Pencil`;
        break;
      default:
    }
  }

  return (
    <div
      id="pencilbutton"
      className={className}
      style={{
        bottom: (holdPaint || showMvmCtrls) ? 180 : 98,
      }}
      role="button"
      title={title}
      onClick={() => dispatch(setHoldPaint(!holdPaint))}
      tabIndex={-1}
    >
      {(holdPaint) ? <TbPencilMinus /> : <TbPencil />}
    </div>
  );
};

export default React.memo(PencilButton);
