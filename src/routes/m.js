/*
 * outputs media file
 */

import { constructMediaPath } from '../utils/media/serverUtils.js';
import { CDN_HOST, NO_CDN_COUNTRIES, NO_CDN } from '../core/config.js';

export default async (req, res) => {
  if (CDN_HOST
    && CDN_HOST !== req.ip.getHost(false, false)
    && !NO_CDN
    && !NO_CDN_COUNTRIES?.includes(req.ip.country)
  ) {
    /*
     * do not allow media requests from any other URL than CDN if CDN_URL is set
     */
    res.redirect(`${req.protocol}://${CDN_HOST}${req.originalUrl}`);
    return;
  }

  const {
    s: shortId,
    e: extension,
  } = req.params;

  res.set({
    'Cache-Control': 'public, s-maxage=5184000, max-age=5184000',
  });
  res.sendFile(constructMediaPath(shortId, extension));
};
