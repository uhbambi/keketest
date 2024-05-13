/*
 * Renders a markdown link
 * Also provides previews
 * Links are assumed to start with protocol (http:// etc.)
 */
import React, { useState } from 'react';
import ReactDOM from 'react-dom';
import { HiArrowsExpand, HiStop } from 'react-icons/hi';
import { HiWindow } from 'react-icons/hi2';
import { t } from 'ttag';

import { getLinkDesc } from '../core/utils';
import EMBEDS from './embeds';
import { isPopUp } from './windows/popUpAvailable';
import useLink from './hooks/link';

const titleAllowed = [
  'odysee',
  'twitter',
  'matrix.pixelplanet.fun',
  'youtube',
  'youtu.be',
  'bitchute',
  'tiktok',
  't.me',
];

const MdLink = ({ href, title, refEmbed }) => {
  const [showEmbed, setShowEmbed] = useState(false);

  const desc = getLinkDesc(href);

  const link = useLink();

  // treat pixelplanet links separately
  if (desc === window.location.hostname && href.includes('/#')) {
    const coords = href.substring(href.indexOf('/#') + 1);
    if (isPopUp() && window.opener && !window.opener.closed) {
      return (
        <a href={`/${coords}`} target="main">{title || coords}</a>
      );
    }
    return (
      <a href={`/${coords}`}>{title || coords}</a>
    );
  }

  const embedObj = EMBEDS[desc];
  const embedAvailable = embedObj && embedObj[1](href);
  const Embed = embedObj && embedObj[0];


  let parsedTitle;
  if (title && titleAllowed.includes(desc)) {
    parsedTitle = title;
  } else if (embedAvailable && embedObj[2]) {
    parsedTitle = embedObj[2](href);
  } else {
    parsedTitle = href;
  }

  return (
    <>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
      >
        {parsedTitle}
      </a>
      {(embedAvailable) && (
        <span className="embbtn">
          &nbsp;
          {(embedObj[3])
            && (
            <img
              style={{
                width: '1em',
                height: '1em',
                verticalAlign: 'middle',
              }}
              src={embedObj[3]}
              alt={`${desc}-icon`}
            />
            )}
          <span
            onClick={(evt) => {
              evt.stopPropagation();
              link('PLAYER', {
                reuse: true,
                target: 'blank',
                args: { uri: href },
              });
            }}
            title={t`Open in PopUp`}
          >
            <HiWindow className="ebex" />
          </span>
          <span
            onClick={() => setShowEmbed(!showEmbed)}
          >
            {(showEmbed)
              ? (
                <HiStop
                  className="ebcl"
                  title={t`Hide Embed`}
                />
              )
              : (
                <HiArrowsExpand
                  className="ebex"
                  title={t`Show Embedded`}
                />
              )}
          </span>
          </span>
      )}
      {showEmbed && embedAvailable && (
        (refEmbed && refEmbed.current)
          ? ReactDOM.createPortal(
            <Embed url={href} />,
            refEmbed.current,
          ) : (
            <Embed url={href} />
          )
      )}
    </>
  );
};

export default React.memo(MdLink);
