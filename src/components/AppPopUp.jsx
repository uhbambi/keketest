/**
 * Main App
 */

import React from 'react';
import { Provider } from 'react-redux';
import { createRoot } from 'react-dom/client';
import { IconContext } from 'react-icons';

import Style from './Style.jsx';
import UIPopUp from './UIPopUp.jsx';
import ContextMenuProvider from './contextmenus/index.jsx';

const iconContextValue = { style: { verticalAlign: 'middle' } };

const AppPopUp = () => (
  <>
    <Style />
    <IconContext.Provider value={iconContextValue}>
      <ContextMenuProvider>
        <UIPopUp />
      </ContextMenuProvider>
    </IconContext.Provider>
  </>
);

function renderAppPopUp(domParent, store) {
  const root = createRoot(domParent);
  root.render(
    <Provider store={store}>
      <AppPopUp />
    </Provider>,
  );
}

export default renderAppPopUp;
