/**
 *
 */

import React from 'react';

const SettingsItemSelect = ({
  title, values, selected, onSelect, icon, children,
}) => (
  <div className="setitem">
    <div className="setrow">
      <h3 className="settitle">{title}</h3>
      {(icon) && <img alt="" src={icon} />}
      <select
        value={selected}
        onChange={(e) => {
          const sel = e.target;
          onSelect(sel.options[sel.selectedIndex].value);
        }}
      >
        {
    values.map((value) => (
      <option
        key={value}
        value={value}
      >
        {value}
      </option>
    ))
  }
      </select>
    </div>
    <div className="modaldesc">{children}</div>
    <div className="modaldivider" />
  </div>
);

export default SettingsItemSelect;
