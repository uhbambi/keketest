/*
 */
import React from 'react';
import { t } from 'ttag';

import LogInForm from './LogInForm.jsx';
import useLink from './hooks/link.js';

const logoStyle = {
  marginRight: 5,
};

const LogInArea = () => {
  const link = useLink();

  /*
   * third party login only works on main url, so if we are on a sharded one,
   * remove the shard. Sadly this means that we have to limit SHARD_NAME to
   * sc[a-z] and non-sharded instances can't be on such a subdomain
   */
  let host = '/';
  if (window.location.host.startsWith('sc')
    && window.location.host.charAt(3) === '.'
  ) {
    host = `${window.location.protocol}//${window.location.host.substring(4)}/`;
  }

  return (
    <div style={{ textAlign: 'center' }}>
      <p>
        {t`Login to access more features and stats.`}
      </p><br />
      <h2>{t`Login with Name or Mail:`}</h2>
      <LogInForm />
      <p
        className="modallink"
        onClick={() => link('FORGOT_PASSWORD')}
        role="presentation"
      >
        {t`I forgot my Password.`}</p>
      <h2>{t`or login with:`}</h2>
      <a href={`${host}api/auth/discord`}>
        <img
          style={logoStyle}
          width={32}
          src="/discordlogo.svg"
          alt="Discord"
        />
      </a>
      <a href={`${host}api/auth/google`}>
        <img
          style={logoStyle}
          width={32}
          src="/googlelogo.svg"
          alt="Google"
        />
      </a>
      <a href={`${host}api/auth/facebook`}>
        <img
          style={logoStyle}
          width={32}
          src="/facebooklogo.svg"
          alt="Facebook"
        />
      </a>
      <a href={`${host}api/auth/vk`}>
        <img
          style={logoStyle}
          width={32}
          src="/vklogo.svg"
          alt="VK"
        />
      </a>
      <a href={`${host}api/auth/reddit`}>
        <img
          style={logoStyle}
          width={32}
          src="/redditlogo.svg"
          alt="Reddit"
        />
      </a>
      <h2>{t`or register here:`}</h2>
      <button
        type="button"
        onClick={() => link('REGISTER')}
      >
        {t`Register`}
      </button>
    </div>
  );
};

export default React.memo(LogInArea);
