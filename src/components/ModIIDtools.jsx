/*
 * Admintools
 */

/* eslint-disable max-len */

import React, { useState } from 'react';
import { t } from 'ttag';

import { parseInterval } from '../core/utils.js';
import { shardOrigin } from '../store/actions/fetch.js';

async function submitIIDAction(
  action,
  iid,
  bid,
  iidoruid,
  identifierList,
  reason,
  duration,
) {
  const data = new FormData();
  data.append('iidaction', action);
  switch (action) {
    case 'givecaptcha':
    case 'whitelist':
    case 'unwhitelist': {
      if (!iid) {
        return t`You must enter an IID`;
      }
      data.append('iid', iid);
      break;
    }
    case 'baninfo': {
      if (!bid) {
        return t`You must enter an BID`;
      }
      data.append('bid', bid);
      break;
    }
    case 'status': {
      if (!iidoruid) {
        return t`You must enter an IID or UserId`;
      }
      data.append('iidoruid', iidoruid);
      break;
    }
    case 'ban': {
      let time = parseInterval(duration);
      if (time === 0 && duration !== '0') {
        return t`You must enter a duration`;
      }
      if (!reason) {
        return t`You must enter a reason`;
      }
      if (time > 0) {
        time += Date.now();
      }
      data.append('reason', reason);
      data.append('time', time);
      // fall through
    }
    case 'unban': {
      if (!identifierList) {
        return t`You must enter at least one IID, User Id or BID`;
      }
      data.append('identifiers', identifierList);
      break;
    }
    default:
      // nothing
  }
  const resp = await fetch(`${shardOrigin}/api/modtools`, {
    credentials: 'include',
    method: 'POST',
    body: data,
  });
  return resp.text();
}

function ModIIDtools() {
  const [iIDAction, selectIIDAction] = useState('givecaptcha');
  const [iid, selectIid] = useState('');
  const [bid, selectBid] = useState('');
  const [iidOrUid, selectIidOrUid] = useState('');
  const [identifierList, setIdentifierList] = useState('');
  const [reason, setReason] = useState('');
  const [duration, setDuration] = useState('1d');
  const [resp, setResp] = useState('');
  const [submitting, setSubmitting] = useState(false);

  return (
    <div style={{ textAlign: 'center', paddingLeft: '5%', paddingRight: '5%' }}>
      <h3>{t`IID Actions`}</h3>
      <select
        value={iIDAction}
        onChange={(e) => {
          const sel = e.target;
          selectIIDAction(sel.options[sel.selectedIndex].value);
        }}
      >
        {['status', 'givecaptcha', 'ban', 'unban', 'whitelist', 'unwhitelist', 'baninfo']
          .map((opt) => (
            <option
              key={opt}
              value={opt}
            >
              {opt}
            </option>
          ))}
      </select>
      {(iIDAction === 'ban') && (
        <React.Fragment key="ban">
          <p>{t`Reason`}</p>
          <input
            maxLength="200"
            style={{
              width: '100%',
            }}
            value={reason}
            placeholder={t`Enter Reason`}
            onChange={(evt) => setReason(evt.target.value)}
          />
          <p>
            {`${t`Duration`}: `}
            <input
              style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '7em',
              }}
              value={duration}
              placeholder="1d"
              onChange={(evt) => {
                setDuration(evt.target.value.trim());
              }}
            />
            {t`(0 = infinite)`}
          </p>
        </React.Fragment>
      )}
      {(iIDAction === 'whitelist' || iIDAction === 'unwhitelist' || iIDAction === 'givecaptcha' || iIDAction === 'ipstatus') && (
        <p>
          IID:&nbsp;
          <input
            value={iid}
            style={{
              display: 'inline-block',
              width: '100%',
              maxWidth: '10em',
            }}
            type="text"
            placeholder="xxxx-xxxxx-xxxx"
            onChange={(evt) => {
              selectIid(evt.target.value.trim());
            }}
          />
        </p>
      )}
      {(iIDAction === 'baninfo') && (
        <p>
          BID:&nbsp;
          <input
            value={bid}
            style={{
              display: 'inline-block',
              width: '100%',
              maxWidth: '10em',
            }}
            type="text"
            placeholder="xxxx-xxxxx-xxxx"
            onChange={(evt) => {
              selectBid(evt.target.value.trim());
            }}
          />
        </p>
      )}
      {(iIDAction === 'status') && (
        <p>
          IID or UserID:&nbsp;
          <input
            value={iidOrUid}
            style={{
              display: 'inline-block',
              width: '100%',
              maxWidth: '10em',
            }}
            type="text"
            onChange={(evt) => {
              selectIidOrUid(evt.target.value.trim());
            }}
          />
        </p>
      )}
      {(iIDAction === 'ban') || (iIDAction === 'unban') && (
        <p>
          IID, UID or BID:&nbsp;
          <textarea
            rows="10"
            cols="17"
            value={identifierList}
            onChange={(e) => setIdentifierList(e.target.value)}
          />
        </p>
      )}
      <p>
        <button
          type="button"
          onClick={async () => {
            if (submitting) {
              return;
            }
            const ret = await submitIIDAction(
              iIDAction, iid, bid, iidOrUid, identifierList, reason, duration,
            );
            setSubmitting(false);
            setResp(ret);
          }}
        >
          {(submitting) ? '...' : t`Submit`}
        </button>
      </p>
      <textarea
        style={{
          width: '100%',
        }}
        rows={(resp) ? resp.split('\n').length : 10}
        value={resp}
        readOnly
      />
    </div>
  );
}

export default React.memo(ModIIDtools);
