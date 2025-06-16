/*
 * get information about ban
 */

import React, { useState, useCallback } from 'react';
import { useDispatch } from 'react-redux';
import { t } from 'ttag';

import useInterval from './hooks/interval';
import useLink from './hooks/link';
import { notify } from '../store/actions/thunks';
import copyTextToClipboard from '../utils/clipboard';
import {
  largeDurationToString,
} from '../core/utils';
import { requestBanInfo } from '../store/actions/fetch';


const BanInfo = ({ close }) => {
  const [errors, setErrors] = useState([]);
  const [bans, setBans] = useState([]);
  const [submitting, setSubmitting] = useState(false);

  const dispatch = useDispatch();
  const link = useLink();

  const handleSubmit = useCallback(async () => {
    if (submitting) {
      return;
    }
    setSubmitting(true);
    setErrors([]);
    const infos = await requestBanInfo();
    setSubmitting(false);
    if (infos.errors) {
      setErrors(infos.errors);
      return;
    }
    let i = infos.length;
    while (i > 0) {
      i -= 1;
      const ban = infos[i];
      ban.expires = ban.sleft && new Date(
        Date.now() + ban.sleft * 1000,
      ).toLocaleString();
    }
    setBans(infos);
  }, [submitting]);

  const countDown = useCallback(() => {
    if (bans.length) {
      const newBans = [];
      let i = bans.length;
      while (i > 0) {
        i -= 1;
        const ban = bans[i];
        if (ban.sleft) {
          const sleft = ban.sleft - 1;
          if (sleft <= 0) {
            continue;
          }
          ban.sleft = sleft;
        }
        newBans.push(ban);
      }
      if (!newBans.length) {
        handleSubmit();
      } else {
        setBans(newBans);
      }
    }
  }, [bans, handleSubmit]);

  useInterval(countDown, 1000);

  /* eslint-disable max-len */
  return (
    <div style={{ userSelect: 'text' }}>
      <p>
        {t`You are banned. You think it is unjustified? Check out the `}
        <span
          role="button"
          tabIndex={0}
          className="modallink"
          onClick={() => {
            link('HELP', { target: 'fullscreen' });
            close();
          }}
        >{t`Help`}</span>
        {t` on how to appeal. And don't forget to include the BID you can get below.`}
      </p>
      {errors.map((error) => (
        <p key={error} className="errormessage">
          <span>{t`Error`}</span>:&nbsp;{error}
        </p>
      ))}
      {bans.map(({ reason, mod, sleft, expires, uuid }, index) => (
        <React.Fragment key={reason + sleft}>
          <h3>{t`Reason`}:</h3>
          <p>{reason}</p>
          {(mod) && (
            <React.Fragment key="mod">
              <h3>{t`By Mod`}:</h3>
              <p>{mod}</p>
            </React.Fragment>
          )}
          {(sleft > 0) && (
            <React.Fragment key="exp">
              <h3>{t`Duration`}:</h3>
              <p>
                {t`Your ban expires at `}
                <span style={{ fontWeight: 'bold' }}>{expires}</span>
                {t` which is in `}
                <span
                  style={{ fontWeight: 'bold' }}
                >
                  {largeDurationToString(sleft)}
                </span>
              </p>
            </React.Fragment>
          )}
          <h3>BID:</h3>
          <p>
            <input
              style={{
                display: 'inline-block',
                width: '100%',
                maxWidth: '18em',
              }}
              readOnly
              value={uuid}
            />
            <button
              type="button"
              onClick={() => {
                copyTextToClipboard(uuid);
                dispatch(notify(t`Copied`));
              }}
            >{t`Copy`}</button>
          </p>
          {(index !== bans.length - 1) && (
            <div className="modaldivider" />
          )}
        </React.Fragment>
      ))}
      <p>
        {(bans.length === 0) && (
          <React.Fragment key="btnr">
            <button
              type="button"
              style={{
                fontWeight: 'bold',
                animation: 'glowing 1300ms infinite',
              }}
              onClick={handleSubmit}
            >
              {(submitting) ? '...' : t`Why?`}
            </button>
            &nbsp;
          </React.Fragment>
        )}
        <button type="submit" onClick={close}>{t`OK`}</button>
      </p>
    </div>
  );
};

export default React.memo(BanInfo);
