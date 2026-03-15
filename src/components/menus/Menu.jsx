/*
 * Menu with Buttons on the top left
 *
 */

import React, {
  useState, useEffect, useRef, useCallback,
} from 'react';
import { useStore } from 'react-redux';

import { useConditionalClickOutside } from '../hooks/clickOutside.js';
import useLink from '../hooks/link.js';
import mainMenu from './mainMenu.js';
import userContextMenu from './userContextMenu.js';
import channelContextMenu from './channelContextMenu.js';
import banMediaContextMenu from './banMediaContextMenu.js';
import { clamp } from '../../core/utils.js';


/**
 * replace element within nested elements array, also reset all 'confirm'
 * type elements
 */
function replaceElement(elements, element) {
  const newElements = [];
  let found = false;
  for (let i = 0; i < elements.length; i += 1) {
    const rElement = elements[i];

    if (rElement.id === element.id) {
      found = true;
      newElements.push(element);
    } else if (rElement.type === 'confirm' && rElement.state) {
      newElements.push({
        ...rElement,
        state: false,
      });
    } else if (rElement.type === 'submenu') {
      const newRElement = replaceElement(elements[i], element);
      if (newRElement !== rElement) {
        found = true;
      }
      newElements.push(newRElement);
    } else {
      newElements.push(rElement);
    }
  }
  if (found) {
    return newElements;
  }
  return elements;
}


const MenuList = ({
  id, elements, x, y, align, isOpen, close, onClick, wrapperRef, className,
}) => {
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [doRender, setDoRender] = useState(false);
  /*
   * wheter or not a submenu is shown
   * active:
   *   defined: show
   *   false: show and tell child to animate the closure
   *   true: show
   * {
   *   [index]: { active, x, y }
   * }
   */
  const [childrenStates, setChildrenStates] = useState({});

  const width = (className === 'MAIN') ? 152 : 125;
  const style = { width };
  switch (align) {
    case 'tr': {
      style.right = clamp(window.innerWidth - x, 0, window.innerWidth - width);
      style.top = y;
      break;
    }
    case 'br': {
      style.right = clamp(window.innerWidth - x, 0, window.innerWidth - width);
      style.bottom = Math.ceil(window.innerHeight - y, 0);
      break;
    }
    case 'bl': {
      style.left = clamp(x, 0, window.innerWidth - width);
      style.bottom = Math.ceil(window.innerHeight - y, 0);
      break;
    }
    default: {
      // also 'tl'
      style.left = clamp(x, 0, window.innerWidth - width);
      style.top = y;
    }
  }

  /*
   * remove a child after it got closed (transition ended within child)
   */
  const closeChild = useCallback((childId) => {
    setChildrenStates((oldState) => {
      const newState = { ...oldState };
      delete newState[childId];
      return newState;
    });
  }, []);

  /**
   * select an element, open submenu and close others if needed
   */
  const changeChildActive = useCallback((evt, childId, isSubMenu) => {
    const rect = evt.currentTarget.getBoundingClientRect();

    setSelectedEntry(childId);
    setChildrenStates((oldState) => {
      const newState = {};

      if (isSubMenu) {
        newState[childId] = {
          active: true,
          x: rect.right + window.scrollX,
          y: rect.top + window.scrollY,
        };
      }

      for (const [prevChildId, state] of Object.entries(oldState)) {
        if (prevChildId !== childId) {
          if (state.active) {
            newState[prevChildId] = { ...state, active: false };
          } else {
            newState[prevChildId] = state;
          }
        }
      }
      return newState;
    });
  }, []);

  const setAllChildrenInactive = useCallback(() => {
    setSelectedEntry(null);
    setChildrenStates((oldState) => {
      const newState = {};
      for (const [prevChildId, state] of Object.entries(oldState)) {
        if (state.active) {
          newState[prevChildId] = { ...state, active: false };
        } else {
          newState[prevChildId] = state;
        }
      }
      return newState;
    });
  }, []);

  useEffect(() => {
    if (isOpen && !doRender) {
      requestAnimationFrame(() => {
        setDoRender(true);
      });
    }
  }, [isOpen, doRender]);

  let menuClassName = 'menu';
  if (className) {
    menuClassName += ` ${className}`;
  }
  if (isOpen && doRender) {
    menuClassName += ' show';
  }

  return (
    <div
      className={menuClassName}
      style={style}
      ref={wrapperRef}
      onTransitionEnd={isOpen ? undefined : () => close(id)}
    >
      {elements.map((element) => {
        const { id: childId } = element;
        let elementClassName = 'menuelement';
        if (selectedEntry === childId) {
          elementClassName += ' selected';
        }

        // eslint-disable-next-line max-len
        const text = (
          <>
            <span className="menuicon">
              {element.symbol && (<element.symbol />)}
            </span>
            <span className="menutext">{element.text}</span>
          </>
        );

        switch (element.type) {
          case 'func':
          case 'link':
            return (
              <div
                key={childId}
                className={elementClassName}
                onClick={() => onClick(element)}
                onMouseEnter={(evt) => changeChildActive(evt, childId)}
              >
                {text}
              </div>
            );
          case 'boolean':
            return (
              <div
                key={childId}
                className={elementClassName}
                onClick={() => onClick(element)}
                onMouseEnter={(evt) => changeChildActive(evt, childId)}
              >
                <span className="menuicon">
                  <input
                    type="checkbox"
                    checked={element.state}
                    onChange={(evt) => {
                      evt.stopPropagation();
                      onClick(element);
                    }}
                  />
                </span><span className="menutext">{element.text}</span>
              </div>
            );
          case 'confirm':
            return (
              <div
                key={childId}
                className={
                  elementClassName + ((element.state) ? ' confirm' : '')
                }
                style={
                  (element.state) ? { backgroundColor: 'red' } : undefined
                }
                onClick={() => onClick(element)}
                onMouseEnter={(evt) => changeChildActive(evt, childId)}
              >
                {text}
              </div>
            );
          case 'spacer':
            return (
              <div
                key={childId}
                className="menuspacer"
              />
            );
          case 'submenu': {
            const childState = childrenStates[childId];
            if (childId === 'ca') return null;
            return (
              <React.Fragment key={childId}>
                <div
                  className={elementClassName}
                  onMouseEnter={(evt) => {
                    changeChildActive(evt, childId, true);
                  }}
                  onClick={(evt) => {
                    if (selectedEntry === childId) {
                      setAllChildrenInactive();
                    } else {
                      changeChildActive(evt, childId, true);
                    }
                  }}
                >
                  {text}
                  <span className="expand-btn">▶</span>
                </div>
                {(childState) && (
                  <MenuList
                    id={childId}
                    elements={element.elements}
                    isOpen={childState.active}
                    x={childState.x}
                    y={childState.y}
                    close={closeChild}
                    onClick={onClick}
                    className={className}
                  />
                )}
              </React.Fragment>
            );
          }
          default:
            return null;
        }
      })}
    </div>
  );
};


const Menu = ({ type, x, y, args, align, isOpen, remove, close }) => {
  const [elements, setElements] = useState([]);
  const wrapperRef = useRef(null);
  /*
   * ref to remember which button we already pressed while it is being
   * processed, to avoid double clicks
   */
  const processStateRef = useRef({});

  const link = useLink();
  const store = useStore();

  useEffect(() => {
    let newElements;
    switch (type) {
      case 'MAIN':
        newElements = mainMenu(store);
        break;
      case 'USER':
        newElements = userContextMenu(store, args);
        break;
      case 'CHANNEL':
        newElements = channelContextMenu(store, args);
        break;
      case 'BANMEDIA':
        newElements = banMediaContextMenu(store, args);
        break;
      default:
        newElements = [];
    }
    setElements(newElements);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, args]);

  const onClick = useCallback(async (element) => {
    const elementId = element.id;
    const processing = processStateRef.current[elementId];
    if (processing) {
      return;
    }
    processStateRef.current[elementId] = true;

    try {
      switch (element.type) {
        case 'link': {
          link(element.link, { target: 'parent' });
          break;
        }
        case 'func': {
          await element.func();
          break;
        }
        case 'boolean': {
          const { state } = element;
          const success = await element.func(state);
          if (success) {
            setElements((oldElements) => replaceElement(oldElements, {
              ...element,
              state: !state,
            }));
          }
          return;
        }
        case 'confirm': {
          const { state } = element;
          if (!state) {
            setElements((oldElements) => replaceElement(oldElements, {
              ...element,
              state: true,
            }));
            return;
          }
          await element.func();

          break;
        }
        default:
          // nothing
      }
    } catch (err) {
      console.error(err);
    } finally {
      delete processStateRef.current[elementId];
    }

    remove();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useConditionalClickOutside(
    [wrapperRef],
    isOpen,
    remove,
  );

  return (
    <MenuList
      x={x}
      y={y}
      align={align}
      isOpen={isOpen}
      close={close}
      elements={elements}
      onClick={onClick}
      wrapperRef={wrapperRef}
      className={type}
    />
  );
};

export default React.memo(Menu);
