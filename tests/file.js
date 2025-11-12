/*
 * test media files
 */
import fs from 'fs';
import path from 'path';

import { processFileStream } from '../src/middleware/media.js';

async function testFile(filePath) {
  const stats = fs.statSync(filePath);
  const filename = path.basename(filePath);
  const ext = path.extname(filename).toLowerCase().slice(1);

  const mimeTypes = {
    'jpg': 'image/jpeg',
    'jpeg': 'image/jpeg',
    'png': 'image/png',
    'gif': 'image/gif',
    'webp': 'image/webp',
    'mp4': 'video/mp4',
  };
  const info = {
    filename: filename,
    mimetype: mimeTypes[ext],
    encoding: '7bit'
  };

  console.log('Starting file processing...');
  console.log(' - Filename:', info.filename);
  console.log(' - Mimetype:', info.mimetype);
  console.log(' - File size:', (stats.size / 1024 / 1024).toFixed(2), 'MB');

  const startTime = Date.now();

  const fileStream = fs.createReadStream(filePath);
  try {
    const result = await processFileStream(fileStream, info);
    console.log(result);
  } catch (error) {
    console.log('ERROR: ', error.message);
  }
  fileStream.on('close', () => console.log('read stream closed'));

  const endTime = Date.now();
}

(async () => {
  await testFile('test.png');
})();
