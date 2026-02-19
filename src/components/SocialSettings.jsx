/*
 * Change Mail Form
 */

import React, { useRef } from 'react';
import { useDispatch, useSelector, shallowEqual } from 'react-redux';
import { RiSave3Line } from 'react-icons/ri';
import { IoTrashOutline } from 'react-icons/io5';
import { t } from 'ttag';

import DeleteList from './DeleteList.jsx';

import {
  setBlockingDm,
  setPrivatize,
  setUserBlock,
  changeProfile,
} from '../store/actions/thunks.js';
import { selectIsDarkMode } from '../store/selectors/gui.js';
import SettingsItem from './SettingsItem.jsx';
import FileUpload from './FileUpload.jsx';
import Avatar from './Avatar.jsx';

const selectBlocks = (state) => [
  state.chat.blocked,
  state.user.blockDm,
  state.user.priv,
  state.user.avatarId,
  state.user.id,
  state.fetching.fetchingApi,
];

/* eslint-disable max-len */
const SocialSettings = ({ done }) => {
  const [
    blocked,
    blockDm,
    priv,
    avatarId,
    userId,
    fetching,
  ] = useSelector(selectBlocks, shallowEqual);
  const isDarkMode = useSelector(selectIsDarkMode);
  const uploadRef = useRef();
  const dispatch = useDispatch();

  return (
    <div className="inarea">
      <div className="setitem">
        <div className="setrow">
          <h3 className="settitle">{t`Avatar`}</h3>
          <div style={{ display: 'flex', flexWrap: 'nowrap' }}>
            <Avatar uid={userId} isDarkMode={isDarkMode} avatarId={avatarId} />
            <FileUpload
              acceptedTypes="image/*"
              maxFiles={1}
              uploadRef={uploadRef}
            />
            <button
              type="button"
              onClick={async () => {
                if (!fetching) {
                  const files = await uploadRef.current?.();
                  if (files.length) {
                    dispatch(changeProfile({ avatarId: files[0].mediaId }));
                  }
                }
              }}
              title={t`Save`}
            >
              {(fetching) ? '...' : (<RiSave3Line />)}
            </button>
            <button
              type="button"
              onClick={async () => {
                if (!fetching) {
                  dispatch(changeProfile({ avatarId: null }));
                }
              }}
              title={t`Clear`}
            >
              {(fetching) ? '...' : (<IoTrashOutline />)}
            </button>
          </div>
        </div>
        <div className="modaldesc">{
          t`Select your Avatar. Supported Formats: jpg, gif, png, webm`
        }</div>
        <div className="modaldivider" />
      </div>
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
    </div>
  );
};

export default React.memo(SocialSettings);
