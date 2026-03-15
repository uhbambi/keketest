/*
 * top left main menu
 */
import {
  // settings cog wheel
  FaCog,
  // Questionmark
  FaQuestion,
  // canvas icon
  FaFlipboard,
} from 'react-icons/fa';
import {
  // download symbol
  MdFileDownload,
  // User Symbol
  MdPerson,
  // 3d symbol,
  Md3dRotation,
} from 'react-icons/md';
import fileDownload from 'js-file-download';
import { t } from 'ttag';

import { getRenderer } from '../../ui/rendererFactory.js';
import { CANVAS_TYPES } from '../../core/constants.js';

function download() {
  const renderer = getRenderer();
  const viewport = renderer.getViewport();
  if (!viewport) return;
  const filename = `pixelplanet-${
    window.location.hash.replace('#', '').replaceAll(',', '-')
  }.png`;
  viewport.toBlob((blob) => fileDownload(blob, filename));
}

export default function mainMenu(store) {
  let elements = [];

  if (store.getState().canvas.rendererType !== CANVAS_TYPES.THREED) {
    elements.push({
      id: 'gl',
      type: 'func',
      symbol: Md3dRotation,
      func: () => {
        const {
          canvasIdent, canvasId, canvasSize, view,
        } = store.getState().canvas;
        const [x, y] = view.map(Math.round);
        // eslint-disable-next-line max-len
        window.location.href = `globe#${canvasIdent},${canvasId},${canvasSize},${x},${y}`;
      },
      text: t`Globe View`,
    });
  }

  elements = elements.concat([
    {
      id: 'ca',
      type: 'submenu',
      symbol: FaFlipboard,
      text: 'Submenu 1',
      elements: [
        {
          id: 'sc1',
          type: 'func',
          symbol: MdFileDownload,
          func: download,
          text: t`Make Screenshot`,
        },
        {
          id: 'ca1',
          type: 'link',
          symbol: FaFlipboard,
          link: 'CANVAS_SELECTION',
          text: t`Canvas Selection`,
        },
      ],
    },
    { id: 's1', type: 'spacer' },
    {
      id: 'pe',
      type: 'link',
      symbol: MdPerson,
      link: 'USERAREA',
      text: t`User Area`,
    },
    {
      id: 'cb',
      type: 'submenu',
      symbol: FaFlipboard,
      text: 'Submenu 2',
      elements: [
        {
          id: 'sc2',
          type: 'func',
          symbol: MdFileDownload,
          func: download,
          text: t`Make Screenshot`,
        },
        {
          id: 'ca2',
          type: 'link',
          symbol: FaFlipboard,
          link: 'CANVAS_SELECTION',
          text: t`Canvas Selection`,
        },
      ],
    },
    { id: 's2', type: 'spacer' },
    {
      id: 'se',
      type: 'link',
      symbol: FaCog,
      link: 'SETTINGS',
      text: t`Settings`,
    },
    {
      id: 'he',
      type: 'link',
      symbol: FaQuestion,
      link: 'HELP',
      text: t`Help`,
    },
  ]);

  return elements;
}
