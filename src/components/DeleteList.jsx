import React, { useState } from 'react';

/**
 * A list of items, where every single entry can be deleted
 * @param list [
 *   [identifier, string, iconUrl], ...
 * ]
 * @param callback that will be called with identifier and string
 * @param joinident if identifier should be shown as well
 * @param enabled boolean
 */
const DeleteList = ({ list, callback, enabled, joinident }) => {
  const [selected, setSelected] = useState(null);
  if (!list.length) {
    return null;
  }

  /* eslint-disable no-nested-ternary */
  return (
    <span className="deletelist">{
      list.map(([identifier, name, iconUrl]) => (
        <div
          key={identifier}
          className={`deletelistitem ${
            (selected === identifier) ? 'selected' : 'unselected'
          }`}
          role="button"
          onClick={() => setSelected(identifier)}
          tabIndex={0}
        >
          {(iconUrl) ? (
            <img key="ic" alt={name} src={iconUrl} />
          ) : '⦸ '}
          {(joinident) ? `${name} [${identifier}]` : `${name} `}
          <button
            type="button"
            disabled={!(enabled && selected === identifier)}
            onClick={() => callback(identifier, name)}
          >
            {(!enabled) ? '...' : (selected === identifier) ? '🗑' : '‣'}
          </button>
        </div>
      ))
    }
    </span>
  );
};

export default React.memo(DeleteList);
