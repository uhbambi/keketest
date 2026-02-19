/*
 * create media thumbnails
 */
import fs from 'fs';
import sharp from 'sharp';

import { getThumbnailPaths } from './serverUtils.js';

export default async function createImageThumbnails(filePath) {
  try {
    const { thumbFilePath, iconFilePath } = getThumbnailPaths(filePath);

    /*
     * first attempt: 320x240
     * second: 200x150
     */
    const previewBuffer = await sharp(filePath).resize(200, 150, {
      fit: 'inside',
      withoutEnlargement: true,
    }).webp({
      quality: 80,
      effort: 4,
    }).toBuffer();

    await Promise.all([
      fs.promises.writeFile(thumbFilePath, previewBuffer),
      sharp(previewBuffer).resize(48, 48, {
        fit: 'cover',
        position: 'center',
      }).webp({ quality: 75 }).toFile(iconFilePath),
    ]);
  } catch (error) {
    console.error(
      `MEDIA: Could not create thumbnails for ${filePath} ${error.message}`,
    );
    throw error;
  }
}
