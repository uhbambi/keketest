/*
 * User gives consent in a json request done by client script on authorization
 * page
 */

import { touchOIDCClient } from '../../data/sql/OIDCClient.js';
import { consentUser } from '../../data/sql/OIDCConsent.js';
import { createAuthCode } from '../../data/sql/OIDCAuthCode.js';
import { resolveSessionUidAndAge } from '../../data/sql/Session.js';

export default async (req, res) => {
  const { t } = req.ttag;
  /*
   * req.bdoy {
   *   ...params from auth request,
   *   clientName,
   *   expirationHours: String 'forever' or 0 or amount hours,
   *   reauthToken: session token, only set in case of reauthentification,
   * }
   */
  const {
    oidcClientModel: clientModel,
  } = req;
  let {
    oidcUserId: uid,
    oidcAuthTime: sessionAge,
    oidcNeedReauth: needReAuth,
  } = req;

  if (req.body.reauthToken) {
    /*
     * reauthorization speciffcally for this request happened, which returns
     * a 1 hour lived session token
     */
    [uid, sessionAge] = await resolveSessionUidAndAge(req.body.reauthToken);
    needReAuth = Number(req.body.max_age) < sessionAge;
  }

  if (!uid || needReAuth) {
    const error = new Error(t`Login is required`);
    error.title = 'login_required';
    error.status = 401;
    throw error;
  }

  let { expirationHours: expiration } = req.body;
  if (expiration === 'forever') {
    expiration = null;
  } else {
    expiration = parseInt(expiration, 10);
    if (Number.isNaN(expiration) || !expiration) {
      // default to 1 hour
      expiration = 1;
    }
    /* from hours to ts */
    expiration = expiration * 1000 * 3600;
  }

  const { scope } = req.body;
  const approvedConsentId = await consentUser(
    clientModel.id, uid, scope, expiration,
  );
  if (!approvedConsentId) {
    throw new Error('Could not store Consent');
  }

  /* touch OIDCClient */
  touchOIDCClient(clientModel.id);

  const code = await createAuthCode(
    approvedConsentId, scope,
    req.body.code_challenge, req.body.code_challenge_method,
    sessionAge, req.body.nonce,
  );
  if (!code) {
    throw new Error('Could not store AuthCode');
  }
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    Expires: '0',
  });
  res.json({ code });
};
