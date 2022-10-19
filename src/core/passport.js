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
  RegUser, ThreePID, USERLVL, OATUH_PROVIDERS, regUserQueryInclude as include,
} from '../data/sql';
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
  // Decide if email or name by the occurrence of @
  // this is why we don't allow @ in usernames
  // NOTE: could allow @ in the future by making an OR query,
  // but i guess nobody really cares.
  //  https://sequelize.org/master/manual/querying.html
  const query = (nameoremail.indexOf('@') !== -1)
    ? { email: nameoremail }
    : { name: nameoremail };
  const reguser = await RegUser.findOne({
    include,
    where: query,
  });
  if (!reguser) {
    done(new Error('Name or Email does not exist!'));
    return;
  }
  if (!compareToHash(password, reguser.password)) {
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
  const provider = OATUH_PROVIDERS[providerString];
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
  if (tpid) {
    await RegUser.findOne({
      include: [
        ...include,
        {
          association: 'tp',
          where: { provider, tpid },
          required: true,
        },
      ],
    });
  }
  if (!reguser && email) {
    reguser = await RegUser.findOne({
      include,
      where: { email },
    });
    if (reguser && tpid) {
      await ThreePID.create({
        uid: reguser.id,
        provider,
        tpid,
      }, {
        raw: true,
      });
    }
  }
  if (!reguser) {
    reguser = await RegUser.findOne({
      where: { name },
      raw: true,
    });
    while (reguser) {
      // name is taken by someone else
      // eslint-disable-next-line max-len
      name = `${name.substring(0, 15)}-${Math.random().toString(36).substring(2, 10)}`;
      // eslint-disable-next-line no-await-in-loop
      reguser = await RegUser.findOne({
        where: { name },
        raw: true,
      });
    }
    logger.info(
      // eslint-disable-next-line max-len
      `Create new user from ${providerString} oauth login ${email} / ${name} / ${tpid}`,
    );
    if (tpid) {
      reguser = await RegUser.create({
        email,
        name,
        userlvl: USERLVL.VERIFIED,
        tp: [{ provider, tpid }],
      }, {
        include: [{
          association: 'tp',
        }],
      });
    } else {
      reguser = await RegUser.create({
        email,
        name,
        userlvl: USERLVL.VERIFIED,
      });
    }
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
    const { displayName: name, emails } = profile;
    const email = emails[0].value;
    const user = await oauthLogin('FACEBOOK', name, email);
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
    const { displayName: name, emails } = profile;
    const email = emails[0].value;
    const user = await oauthLogin('GOOGLE', name, email);
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
    const { displayName: name } = profile;
    const { email } = params;
    if (!email) {
      throw new Error(
        // eslint-disable-next-line max-len
        'Sorry, you can not use vk login with an account that does not have a verified email set.',
      );
    }
    const user = await oauthLogin('VK', name, email);
    done(null, user);
  } catch (err) {
    done(err);
  }
}));


export default passport;
