/**
 *
 * Userdata that gets sent to the client on various api endpoints.
 * This should be the most basic data in order to run the game.
 *
 */
import getLocalizedCanvases from '../canvasesDesc.js';
import { USERLVL } from '../data/sql/index.js';
import { getUserRanks } from '../data/redis/ranks.js';
import { USE_MAILER } from './config.js';
import { USER_FLAGS } from './constants.js';
import chatProvider from './ChatProvider.js';


export default async function getMe(user, lang) {
  let id;
  let name;
  let username;
  let userlvl;
  let havePassword;
  let blockDm;
  let priv;

  /* [[id, name], ...] */
  let blocked;
  /* { id: [name, type, lastTs, dmu] } */
  let channels = { ...chatProvider.getDefaultChannels(lang) };
  const canvases = getLocalizedCanvases(lang);

  if (user) {
    const { data } = user;
    ({ id, name, username, userlvl } = data);
    blockDm = !!(data.flags & (0x01 << USER_FLAGS.BLOCK_DM));
    priv = !!(data.flags & (0x01 << USER_FLAGS.PRIV));
    havePassword = data.password !== null;
    blocked = data.blocked.map(({ id: bid, name: bname }) => [bid, bname]);
    channels = {
      ...channels,
      ...data.channels,
    };
  } else {
    id = 0;
    name = null;
    username = null;
    userlvl = USERLVL.ANONYM;
    havePassword = false;
    blockDm = false;
    blockDm = false;
    priv = false;
    blocked = [];
  }

  const me = {
    id, name, username, userlvl, havePassword, blockDm, priv,
    channels, blocked, canvases,
  };

  if (user) {
    const [
      totalPixels,
      dailyTotalPixels,
      ranking,
      dailyRanking,
    ] = await getUserRanks(user.id);
    me.totalPixels = totalPixels;
    me.dailyTotalPixels = dailyTotalPixels;
    me.ranking = ranking;
    me.dailyRanking = dailyRanking;
  }

  // eslint-disable-next-line max-len
  if (USE_MAILER && userlvl >= USERLVL.REGISTERED && userlvl < USERLVL.VERIFIED) {
    me.messages = ['not_verified'];
  }

  return me;
}
