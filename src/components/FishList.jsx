/*
 * List of caught fishes inside profile
 */
import React from 'react';
import { useSelector } from 'react-redux';
import { t } from 'ttag';
import useLink from './hooks/link';

import { setBrightness, colorFromText } from '../core/utils';
import { FISH_TYPES } from '../core/constants';

const FishList = () => {
  const fishes = useSelector((state) => state.profile.fishes);
  const link = useLink();
  if (!fishes.length) {
    return null;
  }

  return (
    <p className="fishlist">
      <span className="stattext">{t`Phishes`}:</span>
      {fishes.map(({ type, size, ts }) => {
        const { name } = FISH_TYPES[type];
        const shortname = name.toLowerCase().split(' ').join('');
        const backgroundColor = setBrightness(colorFromText(shortname), false);
        return (
          <span
            key={ts}
            style={{
              backgroundColor,
              cursor: 'pointer',
            }}
            className="profilefish"
            title={name}
            onClick={(evt) => {
              evt.stopPropagation();
              link('FISH_DISPLAY', {
                reuse: true,
                target: 'blank',
                args: { type, size, ts },
                title: name,
              });
            }}
          >
            <img
              className={`profilefish-img ${shortname}`}
              src={`/phishes/thumb/${shortname}.webp`}
              alt={name}
            />
            <span
              style={{ color: `hsl(${Math.floor(size / 25 * 120)}, 70%, 75%)` }}
            ><span className="profilefish-size">{size}</span>&nbsp;kg</span>
          </span>
        );
      })}
    </p>
  );
};

export default React.memo(FishList);
