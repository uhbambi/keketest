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
import { USERLVL, THREEPID_PROVIDERS } from '../data/sql';
import {
  getUsersByNameOrEmail,
  getUserByEmail,
  getUserByTpid,
  getNameThatIsNotTaken,
  createNewUser,
  setUserLvl,
} from '../data/sql/User';
import { addOrReplaceTpid } from '../data/sql/ThreePID';
import { auth } from './config';
import { compareToHash } from '../utils/hash';


/**
 * Sign in locally
 */
passport.use(new JsonStrategy({
  usernameProp: 'nameoremail',
  passwordProp: 'password',
}, async (nameoremail, password, done) => {
  const users = await getUsersByNameOrEmail(nameoremail, null);
  if (!users || !users.length) {
    done(new Error('Name or Email does not exist!'));
    return;
  }
  const user = users.find((u) => compareToHash(password, u.password));
  if (!user) {
    if (users.find((u) => u.password === 'hacked')) {
      done(new Error(
        // eslint-disable-next-line max-len
        'This email / password combination got hacked on a different platform and leaked. To protect this account, the password has been reset. Please use the "Forgot my password" function below to set a new password. In the future, consider not installing Malware, Thank You.',
      ));
      return;
    }
    done(new Error('Incorrect password!'));
    return;
  }
  /* this is NOT a full user instance, only { id, name, password, userlvl } */
  done(null, user);
}));

/**
 * OAuth SignIns, either mail or tpid has to be given
 * @param providerString one out of the possible OATUH_PROVIDERS enums
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

  const provider = THREEPID_PROVIDERS[providerString];
  if (!provider) {
    throw new Error(`Can not login with ${providerString}`);
  }
  if (!email && !tpid) {
    throw new Error(
      // eslint-disable-next-line max-len
      `${provider} didn't give us enoguh information to log you in, maybe you don't have an email set in their account?`,
    );
  }

  const promises = [];
  let user;
  // try with associated email
  if (email) {
    user = await getUserByEmail(email);
  }
  // try wwith threepid
  if (!user && tpid) {
    user = await getUserByTpid(provider, tpid);
  }
  // create new user
  if (!user) {
    name = await getNameThatIsNotTaken(name);
    logger.info(
      // eslint-disable-next-line max-len
      `Create new user from ${providerString} oauth login ${email} / ${name} / ${tpid}`,
    );
    user = await createNewUser(name, null);
    if (!user) {
      throw new Error('Could not create user');
    }
  } else if (email && user.userlvl === USERLVL.REGISTERED) {
    /* if oauth is known by mail, ensure that userlvl is VERIFIED */
    promises.push(setUserLvl(user.id, USERLVL.VERIFIED));
  }

  // upsert tpids
  if (tpid) {
    promises.push(addOrReplaceTpid(user.id, provider, tpid));
  }
  if (email) {
    promises.push(
      addOrReplaceTpid(user.id, THREEPID_PROVIDERS.EMAIL, email, true,
      ));
  }
  await Promise.all(promises);

  /* this is NOT a full user instance, only { id, name, password, userlvl } */
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
