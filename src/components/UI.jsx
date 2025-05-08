/**
 *
 */

import React from 'react';
import { useSelector, shallowEqual } from 'react-redux';

import CoolDownBox from './CoolDownBox';
import NotifyBox from './NotifyBox';
import GlobeButton from './buttons/GlobeButton';
import PalselButton from './buttons/PalselButton';
import PencilButton from './buttons/PencilButton';
import MovementControls from './buttons/MovementControls';
import Palette from './Palette';
import Alert from './Alert';
import HistorySelect from './HistorySelect';
import VDay from './VDay';
import useDate from './hooks/useDate';

const UI = () => {
  const [
    isHistoricalView,
    is3D,
    isOnMobile,
  ] = useSelector((state) => [
    state.canvas.isHistoricalView,
    state.canvas.is3D,
    state.user.isOnMobile,
  ], shallowEqual);

  const [day, month] = useDate();

  return (
    <>
      <Alert />
      <MovementControls />
      {(isHistoricalView) ? (
        <HistorySelect id="historyselectfloat" />
      ) : (
        <>
          <PalselButton />
          <Palette />
          {(!is3D) && <GlobeButton />}
          {(!is3D && isOnMobile) && <PencilButton />}
          <CoolDownBox />
        </>
      )}
      {(day === 9 && month === 5) && <VDay />}
      <NotifyBox />
    </>
  );
};

export default React.memo(UI);
