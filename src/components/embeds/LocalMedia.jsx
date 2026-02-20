/*
 * Renders a markdown image embed from our own media storage
 */
/* eslint-disable jsx-a11y/media-has-caption */

import React, { useState, useMemo } from 'react';
import { t } from 'ttag';
import { MdFileDownload } from 'react-icons/md';
import { HiArrowsExpand, HiStop } from 'react-icons/hi';
import { HiWindow } from 'react-icons/hi2';

import useLink from '../hooks/link.js';
import { cdn } from '../../utils/utag.js';
import { splitUrl } from '../../core/utils.js';
import {
  getMediaDetailsFromUrl,
  getUrlsFromMediaIdAndName,
} from '../../utils/media/utils.js';
import { VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from '../../core/constants.js';

const LocalMedia = ({
  url, fill, mediaId, width, height, scrollRef, avgColor,
  title: gTitle, type: gType,
}) => {
  const [expanded, setExpanded] = useState(false);

  const link = useLink();

  const [fullUrl, thumbUrl,, title, type, backgroundColor] = useMemo(() => {
    let mid = mediaId;
    let oTitle = gTitle;
    let oType = gType;

    if (url) {
      [mid, oTitle] = getMediaDetailsFromUrl(url).map((u) => cdn`${u}`);
    }
    const oExtension = mid?.substring(mid.indexOf(':') + 1);

    if (!oType) {
      if (IMAGE_EXTENSIONS.includes(oExtension)) {
        oType = 'image';
      } else if (VIDEO_EXTENSIONS.includes(oExtension)) {
        oType = 'video';
      }
    }

    return [
      ...getUrlsFromMediaIdAndName(mid, oTitle),
      oTitle, oType,
      avgColor && `#${avgColor.toString(16).padStart(6, '0')}`,
    ];
  }, [url, gTitle, gType, mediaId, avgColor]);

  if (!fullUrl || !thumbUrl || !type) {
    return null;
  }

  let thumbWidth = width;
  if (width && height) {
    if (width > 200 || height > 150) {
      const ratio = Math.min(200 / width, 150 / height);
      thumbWidth = Math.round(width * ratio);
    }
  }

  const toggleExpand = () => {
    if (!fill) {
      setExpanded(!expanded);
      if (scrollRef?.current) {
        requestAnimationFrame(() => {
          scrollRef?.current?.();
        });
      }
    }
  };

  const style = (fill) ? {
    height: '100%',
    alignContent: 'center',
    textAlign: 'center',
    maxWidth: '100%',
    flex: '0 1 auto',
    backgroundColor,
  } : {
    display: 'inline-block',
    flex: '0 1 auto',
    width: '100%',
    maxHeight: '100%',
    backgroundColor,
    aspectRatio: (width && height) ? `${width} / ${height}` : undefined,
  };

  if (!fill && width && height) {
    if (expanded) {
      style.maxWidth = width;
    } else {
      style.width = thumbWidth;
    }
  }

  if (thumbUrl && !expanded && !fill) {
    return (
      <div
        className="embtrc"
        style={style}
        onClick={toggleExpand}
      >
        <img
          alt={title}
          src={thumbUrl}
          loading="lazy"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
          }}
        />
      </div>
    );
  }

  const buttons = (
    <span className="embtr">
      <a
        href={fullUrl}
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
                args: { uri: fullUrl },
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
            <HiStop
              className="ebem"
              style={{ color: 'red' }}
              title={t`Shrink`}
            />
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
        switch (type) {
          case 'image':
            return (
              <img
                alt={title}
                src={fullUrl}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'contain',
                }}
                referrerPolicy="no-referrer"
              />
            );
          case 'video':
            return (
              <video
                style={{
                  width: '100%',
                  height: '100%',
                  // height: fill && '100%',
                  // width: fill && '100%',
                  objectFit: 'contain',
                }}
                controls
                autoPlay
                src={fullUrl}
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
  React.memo(LocalMedia),
  (url) => {
    const [path, ext] = splitUrl(url);
    if (!ext || !path.startsWith('/m/') || path[4] === '/') {
      return false;
    }
    return (VIDEO_EXTENSIONS.includes(ext) || IMAGE_EXTENSIONS.includes(ext));
  },
  null,
  '/embico/direct.png',
];
