/*
 * parse only links from a given markdown
 */

import MString from './MString.js';

export default function parseLinksFromMd(rawText, ownHost = null) {
  const text = new MString(rawText);
  const links = [];

  let chr = null;
  while (!text.done()) {
    chr = text.getChar();

    if (chr === '\\') {
      /*
       * escape character
       */
      text.moveForward();
    } else if (chr === ':') {
      /*
       * direct link
       */
      const link = text.checkIfLink();
      if (link !== null) {
        links.push(link);
        continue;
      }
    } else if (chr === '[') {
      /*
       * x[y](z) enclosure
       */
      let zIsLink = true;
      let trimZ = false;
      if (text.iter > 0) {
        text.move(-1);
        /*
         * mediaId in the form shortId:extension
         */
        if (text.getChar() === '$') {
          zIsLink = false;
          trimZ = true;
        }
        text.moveForward();
      }
      const encArr = text.checkIfEnclosure(zIsLink, trimZ);
      if (encArr !== null) {
        links.push(encArr[1]);
      }
    }
    text.moveForward();
  }

  if (ownHost) {
    for (let i = 0; i < links.length; i += 1) {
      const link = links[i];
      const protSeperator = link.indexOf('://') + 3;
      if (protSeperator >= 3 && link.startsWith(ownHost, protSeperator)) {
        const startPath = link.indexOf('/', protSeperator + ownHost.length);
        if (startPath === -1) {
          links[i] = '/';
        } else {
          links[i] = link.substring(startPath);
        }
      }
    }
  }
  return links;
}
