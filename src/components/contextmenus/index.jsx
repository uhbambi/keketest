import React, { useState, useCallback } from 'react';

import ContextMenuContext from '../context/contextmenu.js';
import ContextMenu from './ContextMenu.jsx';

const ContextMenuProvider = ({ children }) => {
  const [menuState, setMenuState] = useState(null);

  const showContextMenu = useCallback((type, x, y, args, align) => {
    setMenuState({ active: true, type, x, y, align, args });
  }, []);

  const remove = useCallback(() => {
    setMenuState((state) => ({ ...state, active: false }));
  }, []);

  const close = useCallback(() => {
    setMenuState(null);
  }, []);

  return (
    <ContextMenuContext.Provider value={showContextMenu}>
      {children}
      {(menuState) && (
      <ContextMenu
        type={menuState.type}
        x={menuState.x}
        y={menuState.y}
        args={menuState.args}
        align={menuState.align}
        active={menuState.active}
        remove={remove}
        close={close}
      />
      )}
    </ContextMenuContext.Provider>
  );
};

export default ContextMenuProvider;
