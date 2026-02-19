/*
 * create media thumbnails
 */
import sharp from 'sharp';
import { spawn } from 'child_process';

import { getThumbnailPaths } from './serverUtils.js';

export default async function createVideoThumbnails(filePath) {
  try {
    const { thumbFilePath, iconFilePath } = getThumbnailPaths(filePath);

    await new Promise((resolve, reject) => {
      const ffmpegProcess = spawn('ffmpeg', [
        '-i', filePath,
        '-ss', '00:00:01',
        '-vframes', '1',
        '-vf', 'scale=200:150:force_original_aspect_ratio=decrease',
        '-qscale:v', 80,
        '-compression_level', '6',
        '-y',
        thumbFilePath,
      ]);

      let stderr = '';
      ffmpegProcess.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      ffmpegProcess.on('close', (code) => {
        if (code !== 0) {
          reject(new Error(`FFmpeg failed with code ${code}: ${stderr}`));
          return;
        }
        resolve();
      });

      ffmpegProcess.on('error', reject);
    });

    await sharp(thumbFilePath).resize(48, 48, {
      fit: 'cover',
      position: 'center',
    }).webp({ quality: 75 }).toFile(iconFilePath);
  } catch (error) {
    console.error(
      `MEDIA: Could not create thumbnails for ${filePath} ${error.message}`,
    );
    throw error;
  }
}
