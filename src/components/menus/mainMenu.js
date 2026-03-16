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
  // paint roller for templates
  FaPaintRoller,
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
import { selectCanvas, setViewCoordinates } from '../../store/actions/index.js';

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
  let elements = [{
    id: 'ca1',
    type: 'link',
    symbol: FaFlipboard,
    link: 'CANVAS_SELECTION',
    text: t`Canvas Selection`,
  }];

  const state = store.getState();

  if (state.canvas.rendererType !== CANVAS_TYPES.THREED) {
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
      id: 'sc1',
      type: 'func',
      symbol: MdFileDownload,
      func: download,
      text: t`Make Screenshot`,
    },
    { id: 's1', type: 'spacer' },
    {
      id: 'pe',
      type: 'link',
      symbol: MdPerson,
      link: 'USERAREA',
      text: t`User Area`,
    },
  ]);

  if (state.templates.available) {
    let templateSubmenu = [{
      id: 'te',
      type: 'link',
      link: 'TEMPLATES',
      text: t`Manage Templates`,
    }];
    const templateList = state.templates.list.map((template, index) => ({
      id: `template-${template.title}${index}`,
      type: 'func',
      text: template.title,
      func: () => {
        store.dispatch(selectCanvas(template.canvasId));
        store.dispatch(setViewCoordinates([
          template.x + template.width / 2, template.y + template.height / 2,
        ]));
      },
    }));
    if (templateList.length) {
      templateSubmenu = templateSubmenu.concat(
        { id: 'st1', type: 'spacer' },
        templateList,
      );
    }

    elements = elements.concat({
      id: 'te',
      type: 'submenu',
      symbol: FaPaintRoller,
      text: t`Templates`,
      elements: templateSubmenu,
    });
  }

  elements = elements.concat([
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
