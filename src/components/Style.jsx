/*
 *
 */

import React from 'react';
import { useSelector } from 'react-redux';

function Style() {
  const style = useSelector((state) => state.gui.style);

  if (!window.ssv.availableStyles) {
    return null;
  }

  const cssUri = window.ssv.availableStyles[style];

  return (style === 'default' || !cssUri) ? null
    : (<link rel="stylesheet" type="text/css" href={cssUri} />);
}

export default React.memo(Style);
