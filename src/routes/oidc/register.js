/**
 * register an oidc client
 */
import express from 'express';

import urlEncoded from '../../middleware/formData.js';
import { ensureLoggedIn, verifySession } from '../../middleware/session.js';
import errorPage from '../../middleware/errorPage.js';
import {
  createOIDCClient, getAllClientsOfUser, deleteClient,
} from '../../data/sql/OIDCClient.js';
import putHtmlIntoShell from '../../ssr/shell.js';
import { USERLVL } from '../../core/constants.js';

const router = express.Router();

/* eslint-disable max-len */

/*
 * Check for POST parameters,
 * if invalid password is given, ignore it and go to next
 */
router.use(verifySession, urlEncoded, async (req, res) => {
  req.tickRateLimiter(5000);
  if (req.csrfPossible || !req.headers.origin) {
    throw new Error('This browser is not supported');
  }

  const { lang, ttag: { t, jt } } = req;
  const title = t`Add an Application (OIDC Client)`;

  if (!req.user) {
    const error = new Error(t`You must be logged in to access this page`);
    error.status = 401;
    throw error;
  }
  if (req.user.userlvl < USERLVL.VERIFIED) {
    throw new Error(t`Your account needs to be verified to access this page`);
  }

  let innerHtml = '';
  let status = 200;
  if (req.method === 'POST') {
    const allowedScopes = [
      'openid', 'email', 'profile', 'offline_access', 'game_data',
      'achievements',
    ];

    const {
      name, uuid = null, reroll_secret: rerollSecret = false, action,
    } = req.body;
    let {
      scope, redirect_uris: redirectUris, default_scope: defaultScope,
    } = req.body;

    try {
      if (action === 'delete') {
        await deleteClient(req.user.id, uuid);
      } else {
        if (!name || !scope || !redirectUris) {
          throw new Error(t`You have to fill out all fields`);
        }
        redirectUris = redirectUris.trim();
        if (redirectUris.length >= 255) {
          throw new Error(t`Too many or too long redirect URIs`);
        }
        redirectUris = redirectUris.replace(' ', '\n').split('\n')
          .map((u) => u.trim()).filter((u) => u);
        if (redirectUris.length > 5) {
          throw new Error(t`Only five redirect URIs are allowed per client`);
        }
        if (redirectUris.length === 0) {
          throw new Error(t`No redirect URI given.`);
        }
        if (redirectUris.some((u) => !u.startsWith('https://'))) {
          throw new Error(t`Redirect URI needs to start with "https://"`);
        }
        if (name.length > 255) {
          throw new Error(t`Name is too long`);
        }
        scope = scope.split(' ').filter(
          (s) => allowedScopes.includes(s),
        );
        if (scope.length < 1) {
          throw new Error(t`You need to define a valid scope`);
        }
        if (defaultScope) {
          defaultScope = defaultScope.split(' ').filter(
            (s) => allowedScopes.includes(s),
          );
          if (defaultScope.length === 0) {
            defaultScope = null;
          }
        }
        await createOIDCClient(
          req.user.id, name, scope, redirectUris, null, defaultScope, uuid,
          rerollSecret,
        );
      }
    } catch (error) {
      status = 400;
      // eslint-disable-next-line max-len
      innerHtml = `<p class="errormessage"><span>${t`Error`}</span>: ${error.message}</p>`;
    }
  }

  const wellKnownUrl = '<a href="/.well-known/openid-configuration">.well-known/openid-configuration</a>';
  innerHtml += `<h2>OpenID Connect (oauth2)</h2>
<div class="client-form-box">
<p style="font-size: 16px;">${jt`Pixelplanet fulfills the OpenID Connect (OIDC) specifications. So an application that supports OIDC could ask for consent and login using pixelplanet accounts. The required endpoints can be auto-discovered via the ${wellKnownUrl} URL.</a>`}</p>
<p style="font-size: 16px;">${jt`You can register your own application here to get the client_id and client_secret needed to make use of this.`}</p>
<p>List of available scopes:</p>
<table className="consenttable">
  <thead>
    <tr>
      <th>${t`Consent`}</th>
      <th>${t`Permission`}</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <th>openid</th>
      <th>${t`User ID and verification level`} (${t`OpenID Connect specs`})</th>
    </tr>
    <tr>
      <th>profile</th>
      <th>${t`Read name, username and account age`}</th>
    </tr>
    <tr>
      <th>email</th>
      <th>${t`Get email address`}</th>
    </tr>
    <tr>
      <th>achievements</th>
      <th>${t`Read Badges and fishes`}</th>
    </tr>
    <tr>
      <th>offline_access</th>
      <th>${t`Regularly update this data`} (${t`OpenID Connect specs`})</th>
    </tr>
    <tr>
      <th>game_data</th>
      <th>${t`Get the amount of Pixels placed and ranking`}</th>
    </tr>
  </tbody>
</table>
</div>
<h2>${t`Add new application`}</h2>
<div class="client-form-box">
  <form method="post" action="register" class="client-form">
    <div class="form-group">
      <label for="name">${t`Client Name`}:</label>
      <input
        type="text"
        name="name"
        placeholder="My OIDC Client"
        required
      />
      <small>${t`Display name for your OIDC client`}</small>
    </div>

    <div class="form-group">
      <label for="redirectUris">${t`Redirect URIs`}:</label>
      <textarea
        name="redirect_uris"
        placeholder="https://example.com/auth/return"
        rows="3"
        required
      ></textarea>
      <small>${t`One redirect URIs per line`}</small>
    </div>

    <div class="form-group">
      <label for="scope">Scope:</label>
      <input
        type="text"
        name="scope"
        placeholder="openid profile email"
        required
      />
      <small>${t`Space-separated list of available scopes`}</small>
    </div>

    <div class="form-group">
      <label for="defaultScope">${t`Default`} Scope:</label>
      <input
        type="text"
        name="default_scope"
        placeholder="openid profile"
      />
      <small>${t`Space-separated list of default scopes, they will be used on requests where no other scope is given.`}</small>
    </div>

    <div class="form-actions">
      <button type="submit" class="btn-primary">${t`Add Application`}</button>
    </div>
  </form>
</div>`;

  const oidcClients = await getAllClientsOfUser(req.user.id);
  if (oidcClients.length > 0) {
    innerHtml += `<h2>${t`Edit existing applications`}</h2>`;
  }
  for (let i = 0; i < oidcClients.length; i += 1) {
    const {
      name, secret, redirectUris, scope, defaultScope, uuid,
    } = oidcClients[i];
    innerHtml += `<div class="client-form-box">
  <form method="post" action="register" class="client-form">
    <div class="form-group">
      <label for="name">${t`Client Name`}:</label>
      <input
        type="text"
        name="name"
        value="${name}"
        placeholder="My OIDC Client"
        required
      />
      <small>${t`Display name for your OIDC client`}</small>
    </div>

    <div class="form-group">
      <label for="client_id">client_id:</label>
      <input
        type="text"
        name="uuid"
        value="${uuid}"
        readonly
        class="readonly-field"
      />
    </div>

    <div class="form-group">
      <label for="client_secret">client_secret</label>
      <input
        type="text"
        name="client_secret"
        value="${secret}"
        readonly
        class="readonly-field"
      />
    </div>

    <div class="form-group checkbox-group">
      <label class="checkbox-label">
        <input
          type="checkbox"
          name="reroll_secret"
          value="true"
        />
        <span class="checkmark"></span>
        ${t`Reroll Client Secret`}
      </label>
      <small>${t`Generate a new client secret. The old secret will become invalid immediately.`}</small>
    </div>

    <div class="form-group">
      <label for="redirectUris">${t`Redirect URIs`}:</label>
      <textarea
        name="redirect_uris"
        placeholder="https://example.com/auth/return"
        rows="3"
        required
      >${redirectUris.split(' ').join('\n')}</textarea>
      <small>${t`One redirect URI per line`}</small>
    </div>

    <div class="form-group">
      <label for="scope">Scope:</label>
      <input
        type="text"
        name="scope"
        value="${scope}"
        placeholder="openid profile email"
        required
      />
      <small>${t`Space-separated list of scopes that should be available`}</small>
    </div>

    <div class="form-group">
      <label for="defaultScope">${t`Default`} Scope:</label>
      <input
        type="text"
        name="default_scope"
        value="${defaultScope || ''}"
        placeholder="openid profile"
      />
      <small>${t`Space-separated list of default scopes, they will be used on requests if no other scope is given.`}</small>
    </div>

    <div class="form-actions">
      <button type="submit" name="action" value="update">${t`Update Application`}</button>
      <button type="submit" name="action" value="delete" class="btn-danger">${t`Delete Application`}</button>
    </div>
  </form>
</div>`;
  }

  innerHtml += `<style>
.btn-danger {
  background-color: #ee2c3e;
  color: white;
  margin-left: auto;
}

h2 {
  text-align: center;
}

.btn-danger:hover {
  background-color: #c82333;
}

.client-form-box {
  border: 2px solid #e0e0e0;
  padding: 2rem;
  margin: 40px;
  background-color: #fafafa;
}

.client-form-box:hover {
  border-color: #c0c0c0;
}

.client-form h2 {
  margin-top: 0;
  margin-bottom: 1.5rem;
  color: #333;
  border-bottom: 1px solid #e0e0e0;
  padding-bottom: 0.5rem;
}

.form-group {
  margin-bottom: 1.5rem;
}

label {
  display: block;
  margin-bottom: 6px;
  font-weight: bold;
  font-size: 16px;
}

input[type="text"],
textarea {
  width: 100%;
  max-width: 100%;
  padding: 0.75rem;
  border: 1px solid #ccc;
  font-family: inherit;
  font-size: 1rem;
  box-sizing: border-box;
}

input[type="text"]:focus,
textarea:focus {
  outline: none;
  border-color: #007bff;
}

.errormessage {
  font-weight: bold;
  text-align: center;
  background-color: #ececce;
}

.readonly-field {
  background-color: #f8f9fa;
  color: #6c757d;
  border-color: #dee2e6;
}

textarea {
  resize: vertical;
  min-height: 80px;
}

small {
  display: block;
  margin-top: 0.25rem;
  color: #6c757d;
  font-size: 0.875rem;
}

.form-actions {
  display: flex;
  gap: 1rem;
}
</style>`;

  res.status(status).send(putHtmlIntoShell(title, title, innerHtml, lang));
}, errorPage);

export default router;
