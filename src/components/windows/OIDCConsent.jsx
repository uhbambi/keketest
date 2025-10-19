/*
 * Consent Request of third party OpenID Connect login
 * This is not the oauth logins (google, facebook, ...), its the others that are
 * logging in with us.
 */

/* eslint-disable max-len */

import React, {
  useMemo, useContext, useState, useEffect,
} from 'react';
import { useSelector, shallowEqual } from 'react-redux';
import { t, jt } from 'ttag';

import WindowContext from '../context/window.js';
import LogInRequired from '../LogInRequired.jsx';
import { requestConsent } from '../../store/actions/fetch.js';

const OIDCConsent = () => {
  const [expirationHours, setExpirationHours] = useState(String(24 * 7));
  const [submitting, setSubmitting] = useState(false);
  const [consentedScopes, setConsentedScopes] = useState([]);
  const [name, username] = useSelector((state) => [
    state.user.name,
    state.user.username,
  ], shallowEqual);

  /*
   * params includes everything the server parsed for oidc and gave us in
   * window.ssv.params, we return the same back
   * additions: clientName needsReauthentication
   */
  const { params } = useContext(WindowContext);

  useEffect(() => {
    if (params.requestedScopes) {
      setConsentedScopes([...params.requestedScopes]);
    } else {
      setConsentedScopes([]);
    }
  }, [params]);

  const scopes = useMemo(() => params.scope?.map((s) => {
    switch (s) {
      case 'profile':
        return [s, t`Read name, username and account age`];
      case 'email':
        return [s, t`Read Email`];
      case 'game_data':
        return [s, t`Read Pixels placed`];
      case 'achievements':
        return [s, t`Read Badges and fishes`];
      case 'offline_access':
        return [s, t`Regular update this data`];
      case 'openid':
        return [s, t`User ID and verification level (usually required)`];
      default:
        return [s, s];
    }
  }), [params]);

  const { redirect_uri: redirectUri, clientName } = params;
  if (!redirectUri) {
    return null;
  }

  const submitConsent = async () => {
    if (!redirectUri || submitting) {
      return;
    }
    setSubmitting(true);
    const { errors, code } = await requestConsent({
      ...params,
      scope: consentedScopes,
      expirationHours,
    });
    let urlParams;
    if (errors) {
      urlParams = {
        error: 'cosent_error',
        error_description: errors[0],
      };
    } else {
      urlParams = { code };
    }
    if (params.state) {
      urlParams.state = params.state;
    }
    urlParams = new URLSearchParams(urlParams);
    window.location.href = `${redirectUri}?${urlParams.toString()}`;
  };

  const consentScope = (evt) => {
    const { target } = evt;
    const newConsentedScopes = consentedScopes.filter(
      (s) => s !== target.value,
    );
    if (target.checked) {
      newConsentedScopes.push(target.value);
    }
    setConsentedScopes(newConsentedScopes);
  };

  const appName = <span className="statvalue">{clientName}</span>;

  let appUrl = redirectUri.substring(redirectUri.indexOf('://') + 3);
  if (appUrl.indexOf('/') !== -1) {
    appUrl = appUrl.substring(0, appUrl.indexOf('/'));
  }
  appUrl = <span className="statvalue">{appUrl}</span>;

  const accountName = <><span className="statvalue">{name}</span>[{` ${username} `}]</>;

  return (
    <LogInRequired
      title={t`Login to grant access to other application.`}
      reauthenticate={params.needsReauthentication}
    >
      <div style={{ textAlign: 'center' }}>
        <h2>{t`Login to other application`}</h2>
        <p>
          {jt`The application ${appName} at ${appUrl} wants to login with your account ${accountName}.`}
          {(scopes.length > 0) && t`It requests the following permissions. Uncheck what you don't want to grant:`}
        </p>
        {(scopes.length > 0) && (
          <table className="consenttable">
            <thead>
              <tr>
                <th>{t`Consent`}</th>
                <th>{t`Permission`}</th>
              </tr>
            </thead>
            <tbody>
              {scopes?.map(([scope, description]) => (
                <tr key={scope}>
                  <th>
                    <input
                      type="checkbox"
                      value={scope}
                      checked={consentedScopes.includes(scope)}
                      onChange={consentScope}
                    />
                  </th>
                  <th>{description}</th>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <p>
          {t`Remember this decision: `}
          <select
            value={expirationHours}
            onChange={(e) => {
              const sel = e.target;
              setExpirationHours(sel.options[sel.selectedIndex].value);
            }}
          >
            <option value={0}>{t`Don't remember`}</option>
            <option value={24}>{t`For one day`}</option>
            <option value={24 * 7}>{t`For one week`}</option>
            <option value={24 * 31}>{t`For one month`}</option>
            <option value={24 * 265}>{t`For one year`}</option>
            <option value="forever">{t`Forever`}</option>
          </select>
        </p>
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            const urlParams = new URLSearchParams({
              error: 'invalid_request',
              error_description: t`You did not consent`,
            });
            if (params.state) {
              urlParams.append('state', params.state);
            }
            window.location.href = `${redirectUri}?${urlParams.toString()}`;
          }}
        >
          {t`Deny`}
        </button>
        <button
          type="button"
          disabled={submitting}
          onClick={submitConsent}
        >
          {(submitting) ? '...' : t`Grant`}
        </button>
      </div>
    </LogInRequired>
  );
};

export default OIDCConsent;
