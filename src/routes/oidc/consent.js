/*
 * User gives consent in a json request done by client script on authorization
 * page
 */

import { consentUser } from '../../data/sql/OIDCConsent.js';
import { createAuthCode } from '../../data/sql/OIDCAuthCode.js';

export default async (req, res) => {
  const { t } = req.ttag;
  /*
   * req.bdoy {
   *   ...params from auth request,
   *   clientName,
   *   expirationHours: String 'forever' or 0 or amount hours,
   * }
   */
  const {
    oidcUserId: uid,
    oidcClientModel: clientModel,
  } = req;
  if (!uid) {
    throw new Error(t`Not logged in`);
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
  const code = await createAuthCode(
    approvedConsentId, scope,
    req.body.code_challenge, req.body.code_challenge_method,
  );
  if (!code) {
    throw new Error('Could not store AuthCode');
  }
  res.status(200).json({ code });
};
