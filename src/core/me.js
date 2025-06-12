/**
 *
 * Userdata that gets sent to the client on
 * various api endpoints.
 *
 */
import getLocalizedCanvases from '../canvasesDesc';
import { USERLVL } from '../data/sql';
import { getUserRanks } from './redis/ranks';
import { USE_MAILER } from './config';
import chatProvider from './ChatProvider';


export default async function getMe(user, lang) {
  const [
    totalPixels,
    dailyTotalPixels,
    ranking,
    dailyRanking,
  ] = await getUserRanks(user.id);

  let id;
  let name;
  let userlvl;
  let mailreg;
  let blockDm;
  let priv;

  /* [[id, name], ...] */
  const blocked = [];
  /* { id: [name, type, lastTs, dmu] } */
  const channels = { ...chatProvider.getDefaultChannels(lang) };
  const canvases = getLocalizedCanvases(lang);

  if (user) {
    ({
      id, name, userlvl, mailreg,
    }) = user;
    blockDm = !!(user.flags & 0x01);
    priv = !!(user.flags & 0x02);

    const userChannels = user.channels;
    let i = userChannels.length;
    while (i > 0) {
      i -= 1;
      const { id: cid, name, type, lastMessage, users } = userChannels[i];
      const channel = [ name, type, lastMessage.getTime() ];
      /* if its a DM, users is populated */
      if (users.length) {
        const dmPartner = users[0];
        channel.push([dmPartner.id, dmPartner.name]);
        channel[0] = dmPartner.name;
      }
      channels[cid] = channel;
    }
  } else {
    id = 0;
    name = null;
    userlvl = USERLVL.ANONYM;
    mailreg = false;
    blockDm = false;
    priv = false;
  }

  const messages = [];
  // eslint-disable-next-line max-len
  if (USE_MAILER && userlvl >= USERLVL.REGISTERED && userlvl < USERLVL.VERIFIED) {
    messages.push('not_verified');
  }

  return {
    id, name, userlvl, mailreg, blockDm, priv,
    channels, blocked, canvases,
    totalPixels, dailyTotalPixels, ranking, dailyRanking,
  }
}
