/*
 * OpenID Connect specs:
 *   https://openid.net/specs/openid-connect-core-1_0.html#Authentication
 */
import express from 'express';

import { resolveSessionUidOfRequest } from '../../middleware/session.js';
import errorPage from '../../middleware/errorPage.js';
import errorJson from '../../middleware/errorJson.js';
import generatePopUpPage from '../../ssr/PopUp.jsx';
import { getOIDCClient } from '../../data/sql/OIDCClient.js';
import { hasUserConsent, consentUser } from '../../data/sql/OIDCConsent.js';
import { createAuthCode } from '../../data/sql/OIDCAuthCode.js';
import consent from './consent.js';

const router = express.Router();

/*
 * botch authorization request and the client consent request, send the same
 * data and it shall be validated the same in both
 */
const validateAuthRequest = async (req, res, next) => {
  const { t } = req.ttag;
  let redirectUri;

  try {
    /*
     * minimum: {
     *  response_type,
     *  client_id,
     *  redirect_url,
     *  scope,
     * }
     * optional: {
     *   code_challenge: PKCE challenge to verify same client requests token that
     *     also requested the whole flow,
     *   code_challenge_method,
     *   state: state to pass around against CSRF,
     *   nonce: only used for id_tokens to avoid replay attacks, we don't use
     *     id_tokens, so we ignore that
     * }
     */
    const params = (req.method === 'GET') ? req.query : req.body;
    const {
      response_type: responseType,
      client_id: clientId,
      code_challenge: codeChallenge,
    } = params;
    let {
      scope,
      code_challenge_method: codeChallengeMethod,
    } = params;
    ({ redirect_uri: redirectUri } = params);

    if (responseType !== 'code') {
      throw new Error(
        t`This application uses a login method we do not support`,
      );
    }
    if (!clientId) {
      throw new Error(t`This application is not allowed to login`);
    }
    /* according to specs, method defaults to 'plain' */
    if (codeChallenge && !codeChallengeMethod) {
      codeChallengeMethod = 'plain';
    }
    if (codeChallengeMethod && (
      codeChallengeMethod !== 'plain' || codeChallengeMethod !== 'S256'
    )) {
      throw new Error(
        t`This application uses a PKCE method we do not support`,
      );
    }
    /*
     * according to specs, we can do whatever we want if no scope is given, we
     * default to emtpy scope
     */
    if (!scope) {
      scope = [];
    } else if (!Array.isArray(scope)) {
      scope = scope.toLowerCase().split(' ');
    }

    const [uid, clientModel] = await Promise.all([
      resolveSessionUidOfRequest(req),
      getOIDCClient(clientId),
    ]);
    if (!clientModel) {
      throw new Error(t`This application is not allowed to login`);
    }
    /*
     * according to specs, if no redirect_uri is given and there is only one, we
     * must use it
     */
    if (!redirectUri) {
      if (clientModel.redirectUris.length === 1) {
        [redirectUri] = clientModel.redirectUris;
      } else {
        throw new Error(
          t`This application sent a faulty login request with no redirection`,
        );
      }
    } else if (!clientModel.redirectUris.includes(redirectUri)) {
      redirectUri = null;
      throw new Error(t`This application redirects to an unallowed page`);
    }
    /*
     * sanitize scopes and go back to openid default if neccessary
     */
    scope = scope.filter((s) => clientModel.scope.includes(s));
    /*
     * overwrite values that might have changed
     */
    params.scope = scope;
    params.redirect_uri = redirectUri;
    params.code_challenge_method = codeChallengeMethod;
    req.oidcUserId = uid;
    req.oidcClientModel = clientModel;
    next();
  } catch (error) {
    error.title = 'invalid_request';
    error.redirectUri = redirectUri;
    throw error;
  }
};

/**
 * Authorization request
 * OpenID standard requires POST support
 * If everything is alright, redirect straight away
 */
router.post('/', express.urlencoded({
  extended: true, limit: '500kB', parameterLimit: 20,
}));
router.use('/', validateAuthRequest, async (req, res) => {
  const params = (req.method === 'GET') ? req.query : req.body;
  const { redirect_uri: redirectUri } = params;
  let { scope } = params;
  const {
    oidcUserId: uid,
    oidcClientModel: clientModel,
  } = req;

  try {
    if (uid) {
      /* client.id is a primary key integer client_id in request is an uuid */
      const consentModel = await hasUserConsent(uid, clientModel.id);
      let approvedConsentId;
      if (consentModel) {
        const { scope: consentedScopes } = consentModel;
        /*
         * if we consented to scopes, but not the once the client wants, ask
         * for all again
         */
        let wantNewScopes = false;
        scope.forEach((s) => {
          if (!consentedScopes.includes(s)) {
            consentedScopes.push(s);
            wantNewScopes = true;
          }
        });
        if (wantNewScopes) {
          scope = consentedScopes;
          params.scope = scope;
        } else {
          approvedConsentId = consentModel.id;
        }
      }
      if (!approvedConsentId && clientModel.autoGrant === 1) {
        /* this client is always allowed and wont expire */
        approvedConsentId = await consentUser(
          clientModel.id, uid, scope, null, consentModel,
        );
      }
      if (approvedConsentId) {
        /* consented without user input */
        const code = await createAuthCode(
          approvedConsentId, scope,
          params.code_challenge, params.code_challenge_method,
        );
        if (code) {
          const responseParams = new URLSearchParams({ code });
          if (params.state) {
            responseParams.state = params.state;
          }
          res.redirect(`${redirectUri}?${responseParams.toString()}`);
          return;
        }
      }
    }

    /*
     * print consent page
     * it is handled like any other popup, however, its not under
     * AVAILABLE_POPUPS because it is handled here, not by main routes, to do
     * instant redirects.
     * We give window.ssv.params to the popup rather than doing it over path
     * args, since we did server side validation of those.
     */
    const { html, etag: winEtag } = generatePopUpPage(req, {
      ...params,
      clientName: clientModel.name,
    });
    res.set({
      'Cache-Control': 'private, no-cache', // seconds
      ETag: winEtag,
    });

    if (!html) {
      res.status(304).end();
      return;
    }
    res.set('Content-Type', 'text/html; charset=utf-8');
    res.status(200).send(html);
  } catch (error) {
    error.title = 'invalid_request';
    error.redirectUri = redirectUri;
    throw error;
  }
}, errorPage);

/*
 * User giving consent and getting the auth code to return to relying party
 */
router.post(
  '/consent', express.json(), validateAuthRequest, consent, errorJson,
);

export default router;
