/**
 * https://scotch.io/tutorials/easy-node-authentication-linking-all-accounts-together#toc-linking-accounts-together
 *
 */

import passport from 'passport';
import JsonStrategy from 'passport-json';
import GoogleStrategy from 'passport-google-oauth2';
import DiscordStrategy from 'passport-discord';
import FacebookStrategy from 'passport-facebook';
import RedditStrategy from 'passport-reddit/lib/passport-reddit/strategy';
import VkontakteStrategy from 'passport-vkontakte/lib/strategy';

import { sanitizeName } from '../utils/validation';
import logger from './logger';
import {
  ThreePID, USERLVL, THREEPID_PROVIDERS,
} from '../data/sql';
import {
  getUsersByNameOrEmail,
  getUsersByEmail,
  getUserByTpid,
  getNameThatIsNotTaken,
  createNewUser,
} from '../data/sql/RegUser';
import User from '../data/User';
import { auth } from './config';
import { compareToHash } from '../utils/hash';

passport.serializeUser((user, done) => {
  done(null, user.id);
});

passport.deserializeUser(async (req, id, done) => {
  const user = new User(req);
  try {
    await user.initialize({ id });
    done(null, user);
  } catch (err) {
    done(err, user);
  }
});

/**
 * Sign in locally
 */
passport.use(new JsonStrategy({
  usernameProp: 'nameoremail',
  passwordProp: 'password',
}, async (nameoremail, password, done) => {
  const regusers = await getUsersByNameOrEmail(nameoremail, null, true);
  if (!regusers.length) {
    done(new Error('Name or Email does not exist!'));
    return;
  }
  const reguser = regusers.find((u) => compareToHash(password, u.password));
  if (!reguser) {
    if (regusers.find((u) => u.password === 'hacked')) {
      done(new Error(
        // eslint-disable-next-line max-len
        'This email / password combination got hacked on a different platform and leaked. To protect this account, the password has been reset. Please use the "Forgot my password" function below to set a new password. In the future, consider to use different passwords on different websites to avoid one leak affecting the others, Thank You.',
      ));
      return;
    }
    done(new Error('Incorrect password!'));
    return;
  }
  const user = new User();
  await user.initialize({ regUser: reguser });
  user.touch();
  done(null, user);
}));

/**
 * OAuth SignIns, either mail or tpid has to be given
 * @param provider one out of the possible OATUH_PROVIDERS enums
 * @param name name of thid party account
 * @param email email
 * @param tpid id of third party account
 *
 */
async function oauthLogin(providerString, name, email = null, tpid = null) {
  name = sanitizeName(name);
  if (email?.length > 40) {
    email = null;
  }

  let provider = THREEPID_PROVIDERS[providerString];
  if (!provider) {
    throw new Error(`Can not login with ${providerString}`);
  }
  if (!email && !tpid) {
    throw new Error(
      // eslint-disable-next-line max-len
      `${provider} didn't give us enoguh information to log you in, maybe you don't have an email set in their account?`,
    );
  }

  let reguser;
  // try with associated email
  if (email) {
    reguser = await getUsersByEmail(email, true);
  }
  // try wwith threepid
  if (!reguser && tpid) {
    reguser = await getUserByTpid(provider, tpid, true);
  }
  // create new user
  if (!reguser) {
    name = await getNameThatIsNotTaken();
    logger.info(
      // eslint-disable-next-line max-len
      `Create new user from ${providerString} oauth login ${email} / ${name} / ${tpid}`,
    );
    reguser = await createNewUser(name, null, null);
    if (!reguser) {
      throw new Error('Could not create user');
    }
  }

  // upsert tpids
  const promises = [];
  let needReload = false;
  if (tpid) {
    if (!reguser.tpids.find(
      (t) => (t.provider === provider && t.tpid === tpid),
    )) {
      needReload = true;
    }
    promises.push(ThreePID.upsert({
      uid: reguser.id,
      provider,
      tpid,
      verified: true,
      lastSeen: new Date(),
    }));
  }
  if (email && (!tpid || !reguser.tpids.find(
    (t) => (t.provider === THREEPID_PROVIDERS.EMAIL && t.tpid === email),
  ))) {
    needReload = true;
    promises.push(ThreePID.upsert({
      uid: reguser.id,
      provider: THREEPID_PROVIDERS.EMAIL,
      tpid: email,
      verified: true,
      lastSeen: new Date(),
    }));
  }
  await Promise.all(promises);
  if (needReload) {
    await reguser.reload();
  }

  const user = new User();
  await user.initialize({ regUser: reguser });
  return user;
}

/**
 * Sign in with Facebook.
 */
passport.use(new FacebookStrategy({
  ...auth.facebook,
  callbackURL: '/api/auth/facebook/return',
  proxy: true,
  profileFields: ['displayName', 'email'],
}, async (req, accessToken, refreshToken, profile, done) => {
  try {
    const { displayName: name, emails, id } = profile;
    const email = emails[0].value;
    const user = await oauthLogin('FACEBOOK', name, email, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

/**
 * Sign in with Discord.
 */
passport.use(new DiscordStrategy({
  ...auth.discord,
  callbackURL: '/api/auth/discord/return',
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { id, email, username: name } = profile;
    const user = await oauthLogin('DISCORD', name, email, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

/**
 * Sign in with Google.
 */
passport.use(new GoogleStrategy({
  ...auth.google,
  callbackURL: '/api/auth/google/return',
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { displayName: name, emails, id } = profile;
    const email = emails[0].value;
    const user = await oauthLogin('GOOGLE', name, email, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

/*
 * Sign in with Reddit
 */
passport.use(new RedditStrategy({
  ...auth.reddit,
  callbackURL: '/api/auth/reddit/return',
  proxy: true,
}, async (accessToken, refreshToken, profile, done) => {
  try {
    const { id } = profile;
    const name = sanitizeName(profile.name);
    // reddit does not give us access to email
    const user = await oauthLogin('REDDIT', name, null, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));

/**
 * Sign in with Vkontakte
 */
passport.use(new VkontakteStrategy({
  ...auth.vk,
  callbackURL: '/api/auth/vk/return',
  proxy: true,
  scope: ['email'],
  profileFields: ['displayName', 'email'],
}, async (accessToken, refreshToken, params, profile, done) => {
  try {
    const { displayName: name, id } = profile;
    const { email } = params;
    if (!email) {
      throw new Error(
        // eslint-disable-next-line max-len
        'Sorry, you can not use vk login with an account that does not have a verified email set.',
      );
    }
    const user = await oauthLogin('VK', name, email, id);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));


export default passport;
