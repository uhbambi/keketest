/*
 * get ThreePIDs and Session information
 */
import { getTPIDsOfUser } from '../../../data/sql/ThreePID.js';
import { censorIdentifier } from '../../../core/utils.js';
import { generateTokenHash } from '../../../utils/hash.js';
import { getAllSessionsOfUser } from '../../../data/sql/Session.js';

export default async (req, res) => {
  const { id: userId } = req.user;
  const [tpids, sessions] = await Promise.all([
    getTPIDsOfUser(userId),
    getAllSessionsOfUser(userId),
  ]);

  for (let i = 0; i < tpids.length; i += 1) {
    const tpid = tpids[i];
    tpid.tpid = censorIdentifier(tpid.tpid);
  }

  for (let i = 0; i < sessions.length; i += 1) {
    const session = sessions[i];
    if (session.token === generateTokenHash(req.user.token)) {
      session.current = true;
    }
    if (!session.os) {
      session.os = 'Unknown';
    }
    if (!session.browser) {
      session.browser = 'Unknown';
    }
    delete session.token;
  }

  /*
   * tpids: {
   *   id, tpid, provider, verified,
   * },
   * sessions: {
   *   id, country, os, browser,
   * }
   */
  res.status(200).json({ tpids, sessions });
};
