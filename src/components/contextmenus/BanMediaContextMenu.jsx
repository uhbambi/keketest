/*
 * context menu for banning media
 */

import React, { useState, useCallback } from 'react';

import { api } from '../../utils/utag.js';
import { MEDIA_BAN_REASONS } from '../../core/constants.js';

/*
 * args: { mediaId }
 */
const BanMediaContextMenu = ({ args: { mediaId }, close }) => {
  const [selected, setSelected] = useState(null);
  const [fetching, setFetching] = useState(false);

  const handleClick = useCallback(async (reason) => {
    if (selected !== reason) {
      setSelected(reason);
    } else {
      setFetching(true);
      const data = new FormData();
      data.append('mediaaction', 'ban');
      data.append('mediaidormbid', mediaId);
      data.append('reason', reason);
      /*
       * its only for mods, so not much error handling here
       */
      await fetch(api`/api/modtools`, {
        credentials: 'include',
        method: 'POST',
        body: data,
      });
      close();
    }
  }, [selected, mediaId, close]);

  const chooseStyle = (reason) => {
    if (selected !== reason) {
      return {};
    }
    return {
      backgroundColor: (fetching) ? 'cyan' : 'red',
    };
  };

  return Object.keys(MEDIA_BAN_REASONS).map((reason) => (
    <div
      key={reason}
      role="button"
      tabIndex={0}
      style={chooseStyle(reason)}
      onClick={(evt) => {
        evt.stopPropagation();
        handleClick(reason);
      }}
    >{reason}</div>
  ));
};

export default React.memo(BanMediaContextMenu);
