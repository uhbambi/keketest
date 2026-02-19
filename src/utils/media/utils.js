/**
 * get extension and name from filename
 * @param filename
 * @return [ name, extension ]
 */
export function splitFilename(filename) {
  const seperator = filename.lastIndexOf('.');
  return [
    filename.substring(0, seperator),
    filename.substring(seperator + 1),
  ];
}

/**
 * add id to filename, used to distinguish between multiple files of the same
 * name
 * @param filename
 * @param id integer
 */
export function addIdToFilename(filename, id) {
  id = String(id);
  const extSeperator = filename.lastIndexOf('.');
  if (extSeperator === -1) {
    return `${filename}:${id}`;
  }
  return `${filename.substring(0, extSeperator)}:${id
  }${filename.substring(extSeperator)}`;
}

/**
 * extract id from filename
 * @param filename
 * @return [filename, id]
 */
export function extractIdFromFilename(filename) {
  let extSeperator = filename.lastIndexOf('.');
  if (extSeperator === -1) {
    extSeperator = filename.length;
  }
  const idSeperator = filename.lastIndexOf(':', extSeperator);
  if (idSeperator === -1) {
    return [filename, null];
  }
  return [
    filename.substring(0, idSeperator) + filename.substring(extSeperator),
    parseInt(filename.substring(idSeperator + 1, extSeperator), 10),
  ];
}

/**
 * generate urls from media id
 * @param mediaId
 * @return [ url, thumbnail, icon ] or null
 */
export function getUrlFromMediaId(mediaId) {
  if (!mediaId) {
    return [null, null, null];
  }
  const [shortId, extension] = mediaId.split(':');
  if (!shortId || !extension) {
    return [null, null, null];
  }
  return [
    `/m/${shortId}/m.${extension}`,
    `/m/t/${shortId}/m.${extension}.webp`,
    `/m/i/${shortId}/m.${extension}.webp`,
  ];
}
