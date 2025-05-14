/*
 * Fish that appears randomly on screen and when catched (clicked) grants a
 * temporary cooldown reduction
 */
import { t } from 'ttag';
import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';

import { pAlert, catchedFish } from '../store/actions';
import socketClient from '../socket/SocketClient';
import { FISH_TYPES } from '../core/constants';

/* eslint-disable max-len */

const Fish = () => {
  const [submitting, setSubmitting] = useState(false);
  const fish = useSelector((state) => state.fish);
  const dispatch = useDispatch();

  const {
    type, size, screenPosX, screenPosY, screenSize, screenRotation,
  } = fish;

  const catchFish = async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    let catched = false;
    try {
      catched = await socketClient.sendCatchFish();
    } catch {
      // nothing
    }
    dispatch(catchedFish(catched));
    if (catched) {
      dispatch(pAlert(
        t`Phish!`,
        t`You catched a Phish! It is a ${FISH_TYPES[type].name} with ${size}kg! As a bonus, your cooldown is reduced.`,
        'info',
      ));
    } else {
      dispatch(pAlert(
        t`No Phish!`,
        t`Oh no, the phish escaped. Better luck next time!`,
        'error',
      ));
    }
  };

  return (
    /* eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions */
    <img
      style={{
        position: 'absolute',
        top: `${screenPosY}%`,
        left: `${screenPosX}%`,
        width: `${screenSize}%`,
        transform: `rotate(${screenRotation}deg)`,
        filter: 'drop-shadow(5px 5px 10px rgba(0, 0, 0, 0.5))',
        cursor: 'pointer',
        zIndex: 9,
      }}
      src={`phishes/${FISH_TYPES[type].name.toLowerCase().split(' ').join('')}.webp`}
      alt={t`A Phish!`}
      onClick={catchFish}
    />
  );
};

export default Fish;
