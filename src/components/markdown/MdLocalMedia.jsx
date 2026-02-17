/*
 * Renders a markdown image embed from our own media storage
 */
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { HiArrowsExpand, HiStop } from 'react-icons/hi';
import { HiWindow } from 'react-icons/hi2';
import { t } from 'ttag';

import useLink from '../hooks/link.js';
import { cdn } from '../../utils/utag.js';
import { splitUrl } from '../../core/utils.js';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from '../../core/constants.js';

const MdLocalMedia = ({ href, title, refEmbed }) => {
  const [expanded, setExpanded] = useState(false);

  const [path, ext, query] = splitUrl(href);
  const seperator = path.indexOf('/m/') + 3;
  if (!ext || seperator < 3) {
    return null;
  }
  const url = (expanded) ? `${path}.${ext}`
    : `${path.substring(0, seperator)}t/${path.substring(seperator)}.${ext}.webp`;

  if (VIDEO_EXTENSIONS.includes(ext)) {
    return (
      <div
        style={{
          textAlign: 'center',
          overflow: 'hidden',
        }}
      >
        <video
          style={{
            maxWidth: '100%',
            maxHeight: 300,
          }}
          controls
          autoPlay
          src={url}
          referrerPolicy="no-referrer"
          onClick={() => setExpanded(!expanded)}
        />
      </div>
    );
  }

  return (
    <div
      style={{
        textAlign: 'center',
        overflow: 'hidden',
      }}
    >
      <img
        alt={`${title}`}
        src={url}
        style={{
          maxWidth: '100%',
          maxHeight: 300,
        }}
        referrerPolicy="no-referrer"
        onClick={() => setExpanded(!expanded)}
      />
    </div>
  );
};

export default React.memo(MdLocalMedia);
