/* eslint-disable max-len */

import React, { useContext } from 'react';

import WindowContext from '../context/window';
import EMBEDS from '../embeds';
import { getLinkDesc } from '../../core/utils';

const Player = () => {
  const { args: { uri } } = useContext(WindowContext);

  const desc = getLinkDesc(uri);

  const embedObj = EMBEDS[desc];
  const Embed = embedObj?.[0];

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#150c00',
    }}>
    <div style={{
      position: 'relative',
      top: '50%',
      transform: 'translateY(-50%)'
    }}>
        <Embed url={uri} />
      </div>
    </div>
  );
};

export default React.memo(Player);
