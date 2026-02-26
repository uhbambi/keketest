/*
 * context for context menus
 */
import { createContext } from 'react';

const ContextMenuContext = createContext();
/*
 * {
 *   openContextMenu(type, x, y, align, args),
 * }
 */

export default ContextMenuContext;
