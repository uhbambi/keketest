/*
 * Renders a markdown image embed from our own media storage
 */
/* eslint-disable jsx-a11y/media-has-caption */

import React, { useState } from 'react';
import { t } from 'ttag';
import { MdFileDownload } from 'react-icons/md';
import { HiArrowsExpand, HiStop } from 'react-icons/hi';
import { HiWindow } from 'react-icons/hi2';

import useLink from '../hooks/link.js';
import { cdn } from '../../utils/utag.js';
import { splitUrl } from '../../core/utils.js';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from '../../core/constants.js';

const MdLocalMedia = ({ url, fill }) => {
  const [expanded, setExpanded] = useState(false);

  const link = useLink();

  const [path, ext] = splitUrl(url);
  const seperator = path.indexOf('/m/');
  if (!ext || seperator === -1) {
    return null;
  }
  const uri = cdn`${path.substring(seperator)}.${ext}`;
  const idName = path.substring(seperator + 3);
  const thumbnail = cdn`/m/t/${idName}.${ext}.webp`;

  let contentType;
  if (IMAGE_EXTENSIONS.includes(ext)) {
    contentType = 'image';
  } else if (VIDEO_EXTENSIONS.includes(ext)) {
    contentType = 'video';
  } else {
    return null;
  }

  const toggleExpand = () => {
    if (!fill) {
      setExpanded(!expanded);
    }
  };

  const style = (fill) ? {
    height: '100%',
    alignContent: 'center',
    textAlign: 'center',
  } : {
    display: 'inline-block',
    margin: 3,
  };

  if (thumbnail && !expanded && !fill) {
    return (
      <div
        className="embtrc"
        style={style}
        onClick={toggleExpand}
      >
        <img
          alt={idName}
          src={thumbnail}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
          }}
        />
      </div>
    );
  }

  const buttons = (
    <span className="embtr">
      <a
        href={uri}
        target="_blank"
        title={t`Download`}
        rel="noreferrer"
      >
        <MdFileDownload className="ebem" />
      </a>
      {(!fill) && (
        <>
          <span
            onClick={(evt) => {
              evt.stopPropagation();
              link('PLAYER', {
                reuse: true,
                target: 'blank',
                args: { uri },
              });
            }}
            title={t`Open in PopUp`}
            key="emebp"
          >
            <HiWindow className="ebem" />
          </span>
          <span
            onClick={toggleExpand}
          >
            {(expanded)
              ? (
                <HiStop
                  className="ebcl"
                  title={t`Shrink`}
                />
              )
              : (
                <HiArrowsExpand
                  className="ebex"
                  title={t`Expand`}
                />
              )}
          </span>
        </>
      )}
    </span>
  );

  return (
    <div
      className="embtrc"
      style={style}
      onClick={toggleExpand}
    >
      {(() => {
        switch (contentType) {
          case 'image':
            return (
              <img
                alt={idName}
                src={url}
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                }}
                referrerPolicy="no-referrer"
              />
            );
          case 'video':
            return (
              <video
                style={{
                  maxWidth: '100%',
                  maxHeight: '100%',
                  height: fill && '100%',
                  width: fill && '100%',
                }}
                controls
                autoPlay
                src={url}
              />
            );
          default:
            return null;
        }
      })()}
      {buttons}
    </div>
  );
};

export default [
  React.memo(MdLocalMedia),
  (url) => {
    const [path, ext] = splitUrl(url);
    const seperator = path.indexOf('/m/');
    if (!ext || seperator === -1 || path[seperator + 4] === '/') {
      return false;
    }
    return (VIDEO_EXTENSIONS.includes(ext) || IMAGE_EXTENSIONS.includes(ext));
  },
  null,
  '/embico/direct.png',
];
