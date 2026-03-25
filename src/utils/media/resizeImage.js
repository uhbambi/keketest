/*
 * resize image
 */
import fs from 'fs';
import sharp from 'sharp';

export default async function resizeImage(filePath, width, height) {
  try {
    const resizedBuffer = await sharp(filePath)
      .resize(width, height)
      .toBuffer();
    fs.writeFileSync(filePath, resizedBuffer);
  } catch (error) {
    console.error(
      `MEDIA: Could not resize image ${filePath} ${error.message}`,
    );
    throw new Error('Could not resize image');
  }
}
