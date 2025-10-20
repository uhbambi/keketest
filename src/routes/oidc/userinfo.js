/*
 * userinfo endpoint called by the relying party
 */
import { getAccessToken } from '../../data/sql/OIDCAccessToken.js';
import { getUserOIDCProfile } from '../../data/sql/User.js';
import { getUserRanks } from '../../data/redis/ranks.js';
import { getFishesOfUser } from '../../data/sql/Fish.js';
import { getBadgesOfUser } from '../../data/sql/Badge.js';

import { USERLVL } from '../../core/constants.js';

export default async (req, res) => {
  req.tickRateLimiter(500);
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Access-Control-Allow-Origin': '*',
    Expires: '0',
  });

  let uid;
  let scope;
  try {
    let { authorization } = req.headers;
    if (!authorization) {
      throw new Error('Authorization header required');
    }
    authorization = authorization.trim();
    if (!authorization.startsWith('Bearer')) {
      throw new Error('Invalid Authorization method');
    }
    authorization = authorization.substring(7).trim();
    const tokenModel = await getAccessToken(authorization);
    if (!tokenModel) {
      throw new Error('Invalid access token');
    }
    ({ uid, scope } = tokenModel);
    if (!scope.length) {
      const err = new Error('Invalid scope of token');
      err.title = 'insufficient_scope';
      throw err;
    }
  } catch (err) {
    res.set({
      // eslint-disable-next-line max-len
      'WWW-Authenticate': `Bearer error="${err.title || 'invalid_request'}", error_description="${err.message}"`,
    });
    res.status(err.status || 401).send();
    return;
  }

  try {
    const payload = {};
    const userProfileModel = await getUserOIDCProfile(uid);
    if (!userProfileModel) {
      const error = new Error('Server experienced an error');
      error.title = 'server_error';
      error.status = 500;
      throw error;
    }
    while (scope.length) {
      switch (scope.pop()) {
        case 'openid': {
          payload.sub = String(uid);
          const { userlvl } = userProfileModel;
          payload.userlvl = userlvl;
          payload.verified = userlvl >= USERLVL.VERIFIED;
          break;
        }
        case 'profile': {
          payload.name = userProfileModel.name;
          payload.preferred_username = userProfileModel.username;
          payload.updated_at = userProfileModel.createdAt;
          break;
        }
        case 'email': {
          payload.email = userProfileModel.email;
          payload.email_verified = userProfileModel.verified;
          break;
        }
        case 'game_data': {
          // eslint-disable-next-line no-await-in-loop
          const ranks = await getUserRanks(uid);
          if (!ranks) {
            const error = new Error('Server experienced an error');
            error.title = 'server_error';
            error.status = 500;
            throw error;
          }
          const [totalPixels, dailyTotalPixels, ranking, dailyRanking] = ranks;
          payload.totalPixels = totalPixels;
          payload.dailyTotalPixels = dailyTotalPixels;
          payload.ranking = ranking;
          payload.dailyRanking = dailyRanking;
          break;
        }
        case 'achievements': {
          // eslint-disable-next-line no-await-in-loop
          const [fishes, badges] = await Promise.all([
            getFishesOfUser(uid),
            getBadgesOfUser(uid),
          ]);
          if (!fishes || !badges) {
            const error = new Error('Server experienced an error');
            error.title = 'server_error';
            error.status = 500;
            throw error;
          }
          payload.fishes = fishes;
          payload.badges = badges;
          break;
        }
        default:
         // nothing
      }
    }
    res.json(payload);
  } catch (err) {
    res.status(err.status || 400).json({
      error: err.title || 'invalid_request',
      error_description: err.message,
    });
  }
};
