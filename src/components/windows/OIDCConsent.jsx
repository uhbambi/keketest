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
import LogInForm from '../LogInForm.jsx';
import { requestConsent } from '../../store/actions/fetch.js';

const OIDCConsent = () => {
  const [expirationHours, setExpirationHours] = useState(String(24 * 7));
  const [submitting, setSubmitting] = useState(false);
  const [consentedScopes, setConsentedScopes] = useState([]);
  /* when logging in to different account */
  const [switchAccount, setSwitchAccount] = useState(false);
  /* only relevant on forced reauthentification */
  const [authReturn, setAuthReturn] = useState(null);

  const [name, username] = useSelector((state) => [
    state.user.name,
    state.user.username,
  ], shallowEqual);

  /*
   * params includes everything the server parsed for oidc and gave us in
   * window.ssv.params, we return the same back
   * additions: clientName needsReauthentication requiredScopes
   */
  const { params } = useContext(WindowContext);

  useEffect(() => {
    if (params.scope) {
      setConsentedScopes([...params.scope]);
    } else {
      setConsentedScopes([]);
    }
  }, [params]);

  const scopes = useMemo(() => params.scope?.map((s) => {
    const required = params.requiredScopes.includes(s);
    switch (s) {
      case 'profile':
        return [s, t`Read name, username and account age`, required];
      case 'email':
        return [s, t`Read Email`, required];
      case 'game_data':
        return [s, t`Read Pixels placed`, required];
      case 'achievements':
        return [s, t`Read Badges and fishes`, required];
      case 'offline_access':
        return [s, t`Regular update this data`, required];
      case 'openid':
        return [s, t`User ID and verification level`, required];
      default:
        return [s, s, required];
    }
  }), [params]);

  if ((params.needsReauthentication || !name || switchAccount) && !authReturn) {
    return (
      <LogInForm
        title={t`Login to grant access to other application.`}
        reauthenticate={params.needsReauthentication}
        onLoginSuccess={setAuthReturn}
      />
    );
  }

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
      reauthToken: authReturn?.token,
    });
    console.log('consent reply', errors, code);
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

  const appName = <span key="a" className="statvalue">{clientName}</span>;

  let appUrl = redirectUri.substring(redirectUri.indexOf('://') + 3);
  if (appUrl.indexOf('/') !== -1) {
    appUrl = appUrl.substring(0, appUrl.indexOf('/'));
  }
  appUrl = <span key="b" className="statvalue">{appUrl}</span>;

  const accountName = (
    <React.Fragment key="c">
      <span className="statvalue">{authReturn ? authReturn.me.name : name}</span>[{` ${authReturn ? authReturn.me.username : username} `}]
    </React.Fragment>
  );

  return (
    <div style={{ textAlign: 'center' }}>
      <h2>{t`Login to other application`}</h2>
      <p className="stattext">
        {jt`The application ${appName} at ${appUrl} wants to login with your account ${accountName}`}{' '}
        <button
          type="button"
          disabled={submitting}
          onClick={() => {
            setAuthReturn(null);
            setSwitchAccount(true);
          }}
        >
          {t`Switch Account`}
        </button>{'. '}
      </p>
      {(scopes.length > 0) && (
        <React.Fragment key="ctt">
          <p>{t`It requests the following permissions. Uncheck what you don't want to grant:`}</p>
          <table className="consenttable">
            <thead>
              <tr>
                <th>{t`Consent`}</th>
                <th>{t`Permission`}</th>
              </tr>
            </thead>
            <tbody>
              {scopes?.map(([scope, description, required]) => (
                <tr key={scope}>
                  <th>
                    <input
                      type="checkbox"
                      value={scope}
                      disabled={required}
                      title={required ? t`This permission is required` : t`Check to allow`}
                      checked={consentedScopes.includes(scope)}
                      onChange={consentScope}
                    />
                  </th>
                  <th>{description}</th>
                </tr>
              ))}
            </tbody>
          </table>
        </React.Fragment>
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
            error: 'consent_required',
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
  );
};

export default OIDCConsent;
