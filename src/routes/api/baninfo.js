/*
 *
 */
import { getBanInfos } from '../../data/sql/Ban';

async function baninfo(req, res) {
  const { t, user, ip: { ipString }} = req.ttag;

  const bans = await getBanInfos(ipString, user?.id);

  if (!bans.length) {
    throw new Error(t`You are not banned`);
  }

  const infos = bans.map((ban) => ({
    uuid: ban.uuid,
    reason: ban.reason,
    /* null if permanent */
    sleft: ban.expires
      && Math.ceil((ban.expires.getTime() - Date.now()) / 1000),
    mod: `${ban.mod.name} (${ban.mod.id})`,
  }));

  res.status(200).json(infos);
}

export default baninfo;
