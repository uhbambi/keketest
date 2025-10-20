/**
 * Authorization request
 * If everything is alright, redirect straight away
 * response_type only 'code'
 */

import { hasUserConsent, consentUser } from '../../data/sql/OIDCConsent.js';
import { createAuthCode } from '../../data/sql/OIDCAuthCode.js';
import generatePopUpPage from '../../ssr/PopUp.jsx';

export default async (req, res) => {
  const params = (req.method === 'GET') ? req.query : req.body;
  const { redirect_uri: redirectUri } = params;
  let { scope } = params;
  const {
    oidcUserId: uid,
    oidcClientModel: clientModel,
    oidcAuthTime: sessionAge,
    oidcNeedReauth: needReAuth,
  } = req;

  try {
    if (uid && !needReAuth) {
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
          sessionAge, params.nonce,
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
      needsReauthentication: needReAuth,
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
    error.title = 'server_error';
    error.redirectUri = redirectUri;
    throw error;
  }
};
