/*
 * display an avatar
 */
import React from 'react';

import { getColorFromId, getCharFromId } from '../core/utils.js';
import { cdn } from '../utils/utag.js';

const Avatar = ({ uid, isDarkMode, avatarId }) => {
  const avatarStyle = {
    backgroundColor: getColorFromId(uid, isDarkMode),
    color: (isDarkMode) ? '#636363' : '#a7a5a5',
  };
  if (avatarId) {
    const [, extension] = avatarId.split(':');
    avatarStyle.backgroundImage = cdn`/m/t/shortId/avatar.${extension}.webp`;
  }

  return (
    <div className="avatar" style={avatarStyle}>
      {!avatarId && getCharFromId(uid)}
    </div>
  );
};

export default React.memo(Avatar);
