import path from 'path';

import { MEDIA_FOLDER } from '../../core/config.js';

/**
 * get paths for icon and thumbnail
 * @param filePath path of existing media file
 * @return { thumbFilePath, iconFilePath }
 */
export function getThumbnailPaths(filePath) {
  const { dir, name, ext } = path.parse(filePath);
  let thumbFilePath = path.join(dir, `${name}_${ext.substring(1)}`);
  const iconFilePath = `${thumbFilePath}_icon.webp`;
  thumbFilePath += '_thumb.webp';
  return { thumbFilePath, iconFilePath };
}

/**
 * create path to media file by shortid and extension, (this maybe shouldn't be
 * in this file?)
 * @param shortId
 * @param extension
 * @return local path to media file
 */
export function constructMediaPath(shortId, extension, type) {
  // eslint-disable-next-line max-len
  const folder = path.resolve(MEDIA_FOLDER, shortId.substring(0, 2), shortId.substring(2, 4));
  if (type === 't') {
    // thumbnail
    return path.join(folder, `${shortId.substring(4)}_${extension}_thumb.webp`);
  }
  if (type === 'i') {
    // icon
    return path.join(folder, `${shortId.substring(4)}_${extension}_icon.webp`);
  }
  return path.join(folder, `${shortId.substring(4)}.${extension}`);
}

const typeToExt = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpeg', 'jpg'],
  'image/png': 'png',
  'image/gif': 'gif',
  /*
   * no support in sharpjs yet
   * 'image/jxl': 'jxl',
   */
  'image/webp': 'webp',
  'video/webm': 'webm',
  'video/mp4': 'mp4',
};

/**
 * check if mime type fit to its extension
 * @param mimeType
 * @param filename
 * @return boolean
 */
export function mimeTypeFitsToExt(mimeType, filename) {
  const allowedExtensions = typeToExt[mimeType];
  const seperator = filename.lastIndexOf('.');
  if (seperator === -1 || !allowedExtensions) {
    return false;
  }
  const extension = filename.substring(seperator + 1);

  if (Array.isArray(allowedExtensions)) {
    return allowedExtensions.includes(extension);
  }
  return extension === allowedExtensions;
}

/**
 * check if mime type is allowed to be uploaded
 * @param mimeType
 * @return boolean
 */
export function isMimeTypeAllowed(mimeType) {
  if (typeToExt[mimeType]) {
    return true;
  }
  return false;
}
