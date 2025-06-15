/*
 * tell user his own IID
 */
import {
  getIPFromRequest,
  getIPv6Subnet,
} from '../../utils/ip';
import {
  getIIDofIP,
} from '../../data/sql/IP';

async function getiid(req, res, next) {
  try {
    const iid = await getIIDofIP(req.ip.ipString);
    if (!iid) {
      throw new Error('Could not get IID');
    }

    res.status(200).json({ iid });
  } catch (err) {
    next(err);
  }
}

export default getiid;
