import React from 'react';

import DirectLinkEmbed from './DirectLinkEmbed';

function getIdFromURL(url) {
  let vPos = -1;
  let corLength = 2;
  if (url.includes('youtube')) {
    if (url.includes('/shorts/')) {
      vPos = url.indexOf('/shorts/');
      corLength = 8;
    } else {
      vPos = url.indexOf('v=');
    }
  } else if (url.includes('youtu.be')) {
    vPos = url.indexOf('e/');
  }
  if (vPos === -1) {
    return null;
  }
  vPos += corLength;
  let vEnd;
  for (vEnd = vPos;
    vEnd < url.length && !['&', '?', '/'].includes(url[vEnd]);
    vEnd += 1);
  return url.substring(vPos, vEnd);
}

const YouTube = ({ url, fill }) => {
  const id = getIdFromURL(url);
  if (!id) {
    return null;
  }
  const Embed = DirectLinkEmbed[0];
  return (
    <Embed
      url={`https://www.youtube.com/embed/${id}?autoplay=1`}
      fill={fill}
      aspectRatio={url.includes('/shorts/') && '177.77%'}
    />
  );
};

export default [
  React.memo(YouTube),
  getIdFromURL,
  getIdFromURL,
  '/embico/youtube.png',
];
