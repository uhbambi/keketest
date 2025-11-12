/*
 * middleware and related functions for media upload
 */
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import { getRandomString } from '../core/utils.js';
import path from 'path';
import fs from 'fs';

import { MAX_MEDIA_SIZE } from '../core/constants.js';
import { MEDIA_FOLDER } from '../core/config.js';

const typeToExt = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpeg', 'jpg'],
  'image/png': 'png',
  'image/jxl': 'jxl',
  'image/webp': 'webp',
};

export function processFileStream(fileStream, info, restrictType) {
  const { mimetype } = info;

  return new Promise((resolve, reject) => {
    /*
     * ensure sane type
     */
    let filename = info.filename?.trim();
    if (!filename || !mimetype) {
      reject(new Error('no_info'));
      return;
    }
    const ext = filename.substring(filename.lastIndexOf('.') + 1);
    const allowedExts = typeToExt[mimetype];

    if (!allowedExts
      || (Array.isArray(allowedExts) && !allowedExts.includes(ext))
      || (!Array.isArray(allowedExts) && ext !== allowedExts)
    ) {
      reject(new Error('unknown_type'));
      return;
    }

    let type;
    if (mimetype.startsWith('image/')) {
      type = 'image';
    } else if (mimetype.startsWith('video/')) {
      type = 'video';
    }
    if (restrictType && type !== restrictType) {
      reject(new Error('invalid_type'));
      return;
    }

    /*
     * media repository with mapped directories and random filename
     */
    const fullTargetFilename = getRandomString()
      + getRandomString() + '.' + ext;
    const targetFolder = path.resolve(
      MEDIA_FOLDER,
      fullTargetFilename.substring(0, 2),
      fullTargetFilename.substring(2, 4),
    );
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    const targetFile = path.resolve(
      targetFolder, fullTargetFilename.substring(4),
    );

    let ended = false;
    let totalSize = 0;
    let startTime = Date.now();
    let timeoutStartTime;
    let timeout;
    /*
     * calculate hash (before exif removal)
     */
    const writeStream = fs.createWriteStream(targetFile);
    const hash = createHash('sha256');
    /*
     * exiftool to strip exif data
     */
    const removeExifStream = spawn('exiftool', [
      '-all=', '-o', '-', '-'
    ], {
      shell: process.platform == 'win32',
    });

    const cancel = (error) => {
      if (ended) {
        return true;
      }
      ended = true;
      clearTimeout(timeout);
      fileStream.destroy();
      removeExifStream.stdin.destroy();
      removeExifStream.stdout.destroy();
      removeExifStream.stderr.destroy();
      writeStream.destroy();
      if (fs.existsSync(targetFile)) {
          fs.rmSync(targetFile);
      }
      if (typeof error === 'string') {
        error = new Error(error);
      }
      reject(error);
    };

    /*
     * have to deel with drip-feeding data to hog up resources
     */
    const resetTimeout = () => {
      if (timeout) {
        clearTimeout(timeout);
      }
      timeoutStartTime = Date.now();
      timeout = setTimeout(() => cancel('stalled'), 30000);
    }

    resetTimeout();

    fileStream.on('data', (chunk) => {
      if (ended) {
        return;
      }
      totalSize += chunk.length;
      if (totalSize > MAX_MEDIA_SIZE) {
        cancel('too_long');
        return;
      }
      const now = Date.now();
      if (now - timeoutStartTime > 15000) {
        if (totalSize / (now - startTime) < 8) {
          cancel('stalled');
          return;
        }
        resetTimeout();
      }
    });

    removeExifStream.on('error', cancel);
    fileStream.on('error', cancel);
    writeStream.on('error', cancel);


    removeExifStream.stdout.on('data', (chunk) => {
      if (ended) {
        return;
      }
      if (!writeStream.write(chunk)) {
        removeExifStream.stdout.pause();
      }
      hash.update(chunk);
    });

    writeStream.on('drain', () => {
      if (ended) {
        return;
      }
      removeExifStream.stdout.resume();
    });

    removeExifStream.on('close', (code) => {
      if (code) {
        cancel('exif_fail');
        return;
      }
      writeStream.end();
    });

    writeStream.on('close', () => {
      if (ended) {
        return;
      }
      ended = true;
      clearTimeout(timeout);
      /* just to make sure */
      fileStream.destroy();
      removeExifStream.stdin.destroy();
      removeExifStream.stdout.destroy();
      removeExifStream.stderr.destroy();

      resolve({
        sha: hash.digest('hex'),
        file: targetFile,
        type,
        mimetype,
      });
    });

    fileStream.pipe(removeExifStream.stdin);
  });
}
