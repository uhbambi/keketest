/*
 * Change Mail Form
 */

import React, { useState } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { t } from 'ttag';

import DeleteList from './DeleteList.jsx';

import {
  setBlockingDm,
  setPrivatize,
  setUserBlock,
  changeCustomFlag,
} from '../store/actions/thunks.js';
import SettingsItem from './SettingsItem.jsx';

const selectBlocks = (state) => [
  state.chat.blocked,
  state.user.blockDm,
  state.user.priv,
  state.fetching.fetchingApi,
];

/* eslint-disable max-len */
const SocialSettings = ({ done }) => {
  const [
    blocked,
    blockDm,
    priv,
    fetching,
  ] = useSelector(selectBlocks, shallowEqual);
  const dispatch = useDispatch();
  const [code, setCode] = useState('');

  return (
    <div className="inarea">
      <SettingsItem
        title={t`Block DMs`}
        value={blockDm}
        onToggle={() => {
          if (!fetching) {
            dispatch(setBlockingDm(!blockDm));
          }
        }}
      >{t`Block all Private Messages. Enabling this will delete all your current DMs. You can still start new DMs with other users, but other users won't be able to start DMs with you.`}</SettingsItem>
      <SettingsItem
        title={t`Private`}
        value={priv}
        onToggle={() => {
          if (!fetching) {
            dispatch(setPrivatize(!priv));
          }
        }}
      >{t`Don't show me in global stats`}</SettingsItem>
      <h3
        style={{
          textAlign: 'left',
          marginLeft: 10,
        }}
      >{t`Unblock Users`}</h3>
      {
        (blocked.length) ? (
          <DeleteList
            list={blocked}
            callback={(id, name) => {
              if (!fetching) {
                dispatch(setUserBlock(id, name, false));
              }
            }}
            enabled={!fetching}
          />
        )
          : <p>{t`You have no users blocked`}</p>
      }
      <div className="modaldivider" />
      <button
        type="button"
        onClick={done}
        style={{ margin: 10 }}
      >
        Done
      </button>
      <div className="modaldivider" />
      <h3>{t`Change chat flag`}</h3>
      <p>
        {t`Enter flag code`}:&nbsp;
        <input
          value={code}
          style={{
            display: 'inline-block',
            width: '100%',
            maxWidth: '20em',
          }}
          type="text"
          minLength="2"
          maxLength="3"
          onChange={(evt) => setCode(evt.target.value.trim())}
        />
      </p>
      <p>
        <button
          type="button"
          onClick={() => {
            if (!fetching) {
              dispatch(changeCustomFlag(code));
            }
          }}
        >
          {(fetching) ? '...' : t`Change`}
        </button>
      </p>
    </div>
  );
};

export default React.memo(SocialSettings);
