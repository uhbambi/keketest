/**
 *
 * Userdata that gets sent to the client on various api endpoints.
 * This should be the most basic data in order to run the game.
 *
 */
import getLocalizedCanvases from '../canvasesDesc';
import { USERLVL } from '../data/sql';
import { getUserRanks } from './redis/ranks';
import { USE_MAILER } from './config';
import chatProvider from './ChatProvider';


export default async function getMe(user, lang) {
  let id;
  let name;
  let userlvl;
  let mailreg;
  let blockDm;
  let priv;

  /* [[id, name], ...] */
  const blocked = [];
  /* { id: [name, type, lastTs, dmu] } */
  let channels = { ...chatProvider.getDefaultChannels(lang) };
  const canvases = getLocalizedCanvases(lang);

  if (user) {
    const { data } = user;
    ({
      id, name, userlvl, mailreg,
    } = data);
    blockDm = !!(data.flags & 0x01);
    priv = !!(data.flags & 0x02);
    channels = {
      ...channels,
      ...user.channels,
    };
  } else {
    id = 0;
    name = null;
    userlvl = USERLVL.ANONYM;
    mailreg = false;
    blockDm = false;
    priv = false;
  }

  const me = {
    id, name, userlvl, mailreg, blockDm, priv,
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
    me['messages'] = ['not_verified']
  }

  return me;
}
