/*
 * middleware and related functions for media upload
 */
import { createHash } from 'crypto';
import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';

import { getRandomString } from '../core/utils.js';
import { registerMedia, hasMedia } from '../data/sql/Media.js';
import { MAX_MEDIA_SIZE } from '../core/constants.js';
import { MEDIA_FOLDER } from '../core/config.js';

const typeToExt = {
  'image/jpeg': ['jpg', 'jpeg'],
  'image/jpg': ['jpeg', 'jpg'],
  'image/png': 'png',
  'image/jxl': 'jxl',
  'image/webp': 'webp',
};

const queue = [];
let isStripping = false;
let exiftoolProcess;
let responseBuffer = '';

function spawnExiftool(resultCallback) {
  exiftoolProcess = spawn('exiftool', [
    '-stay_open', 'True', '-@', '-',
  ], {
    shell: process.platform === 'win32',
  });

  const cleanUp = () => {
    if (exiftoolProcess) {
      exiftoolProcess.stdin.destroy();
      exiftoolProcess.stdout.destroy();
      exiftoolProcess.stderr.destroy();
      exiftoolProcess = null;
    }
    for (let i = 0; i < queue.length; i += 1) {
      queue[i][1]();
    }
    queue.length = 0;
    responseBuffer = '';
    isStripping = false;
  };

  exiftoolProcess.on('close', cleanUp);
  exiftoolProcess.on('error', cleanUp);

  exiftoolProcess.stderr.on('data', (data) => {
    console.error('MEDIA: EXIF', data.toString());
  });

  exiftoolProcess.stdout.on('data', (data) => {
    responseBuffer += data.toString();

    if (responseBuffer.includes('{ready}')) {
      const responses = responseBuffer.split('{ready}');

      for (let i = 0; i < responses.length - 1; i++) {
        const response = responses[i].trim();
        /*
         * errors is also on stdout
         */
        if (response && queue.length > 0) {
          const [filename, callback] = queue.shift();
          if (response.toLowerCase().includes('error')) {
            console.error(
              `MEDIA: EXIF stripping failed for ${filename}: ${response}`,
            );
            console.log(filename, response);
          }
          callback();
        }
      }

      responseBuffer = responses[responses.length - 1] || '';
      setTimeout(resultCallback, 10);
    }
  });
}

export function killExiftool() {
  console.log('End exiftool child process');
  return new Promise((resolve) => {
    if (exiftoolProcess && !exiftoolProcess.killed) {
      exiftoolProcess.stdin.write('-stay_open\nFalse\n-execute\n');
      setTimeout(() => {
        if (exiftoolProcess && !exiftoolProcess.killed) {
          exiftoolProcess.kill('SIGTERM');
        }
        resolve();
      }, 1000);
    }
  });
}

function stripExifFromQueue() {
  if (!queue.length) {
    isStripping = false;
    return;
  }
  isStripping = true;
  if (!exiftoolProcess) {
    spawnExiftool(stripExifFromQueue);
  }
  const command = `${queue[0][0]}\n-all=\n-overwrite_original\n-execute\n`;

  exiftoolProcess.stdin.write(command, (error) => {
    if (error) {
      queue.shift()[1]();
      stripExifFromQueue();
    }
  });
}

export function stripExif(filename) {
  return new Promise((resolve) => {
    queue.push([filename, resolve]);
    if (!isStripping) {
      stripExifFromQueue();
    }
  });
}

export function mimeTypeFitsToExt(mimeType, filename) {
  return filename.endsWith(`.${typeToExt(mimeType)}`);
}

export function isMimeTypeAllowed(mimeType) {
  if (typeToExt[mimeType]) {
    return true;
  }
  return false;
}

/**
 * store media file from filestream
 * @param fileStream
 * @param info { mimeType, filename }
 * @param [hashCheck] sha256 hash in hex that we check against
 * @param [restrictType] exclusive type to allow 'audio', 'video', 'image', ...
 * @return {
 *   hash,
 *   extension,
 *   mimeType,
 *   shortId,
 *   name,
 * }
 */
export async function processFileStream(
  fileStream, info, hashCheck, restrictType,
) {
  console.log('parse enter');
  const { mimeType } = info;

  /*
    * ensure sane type
    */
  const filename = info.filename?.trim();
  if (!filename || !mimeType) {
    if (!fileStream.destroyed) {
      fileStream.destroy();
    }
    throw new Error('no_info');
  }
  const seperator = filename.lastIndexOf('.');
  const name = filename.substring(0, seperator);
  const extension = filename.substring(seperator + 1);
  const allowedExts = typeToExt[mimeType];
  /*
    * store file temporary until we got hash
    */
  const tmpFolder = path.resolve(MEDIA_FOLDER, 'tmp');
  const temporaryFile = path.join(
    tmpFolder, `${getRandomString() + getRandomString()}.${extension}`,
  );

  if (hashCheck) {
    /*
    * if hash got given already, check if file already exists
    */
    const existingMediaModel = await hasMedia(hashCheck, mimeType, name);
    if (existingMediaModel) {
      /*
        * mark that it already exists, so that filestream can be recovered
        * if more files are to be read
        */
      existingMediaModel.existed = true;
      return existingMediaModel;
    }
  }

  if (!allowedExts
    || (Array.isArray(allowedExts) && !allowedExts.includes(extension))
    || (!Array.isArray(allowedExts) && extension !== allowedExts)
  ) {
    throw new Error('unknown_type');
  }

  let type;
  if (mimeType.startsWith('image/')) {
    type = 'image';
  } else if (mimeType.startsWith('video/')) {
    type = 'video';
  }
  if (restrictType && type !== restrictType) {
    throw new Error('invalid_type');
  }

  /*
  * make sure temporary folder exists
  */
  if (!fs.existsSync(tmpFolder)) {
    fs.mkdirSync(tmpFolder, { recursive: true });
  }

  try {
    const size = await new Promise((resolve, reject) => {
      let ended = false;
      let totalSize = 0;
      const startTime = Date.now();
      let timeoutStartTime;
      let timeout;

      const writeStream = fs.createWriteStream(temporaryFile);

      const cancel = (error) => {
        if (ended) {
          return;
        }
        ended = true;
        clearTimeout(timeout);
        writeStream.destroy();
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
      };

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

      fileStream.on('error', cancel);
      fileStream.on('limit', cancel);
      writeStream.on('error', cancel);

      fileStream.on('close', () => console.log('reading done'));
      writeStream.on('close', () => {
        if (ended) {
          return;
        }
        console.log('writing done');
        ended = true;
        clearTimeout(timeout);
        resolve(totalSize);
      });

      fileStream.pipe(writeStream);
    });

    /*
    * strip exif data
    */
    await stripExif(temporaryFile);
    console.log('stripped exif success');

    /*
    * calculate hash
    */
    const hash = await new Promise((resolve, reject) => {
      const readStream = fs.createReadStream(temporaryFile);
      const cryptHash = createHash('sha256');

      readStream.on('data', (chunk) => {
        cryptHash.update(chunk);
      });

      readStream.on('end', () => {
        resolve(cryptHash.digest('hex'));
      });

      readStream.on('error', (error) => {
        reject(error);
      });
    });

    /*
    * check if file already exists
    */
    const existingMediaModel = await hasMedia(hash, mimeType, name);
    if (existingMediaModel) {
      return existingMediaModel;
    }

    /*
    * move it to target folder by hash
    */
    let targetFile = `${hash}.${extension}`;
    const targetFolder = path.resolve(
      MEDIA_FOLDER,
      targetFile.substring(0, 2),
      targetFile.substring(2, 4),
    );
    if (!fs.existsSync(targetFolder)) {
      fs.mkdirSync(targetFolder, { recursive: true });
    }
    targetFile = path.resolve(targetFolder, targetFile.substring(4));
    fs.renameSync(temporaryFile, targetFile);

    try {
      console.log('register media');
      const model = await registerMedia(
        hash, extension, mimeType, type, size, name,
      );
      console.log('done registering media', model);
      if (!model) {
        throw new Error('sql_error');
      }

      return model;
    } catch (error) {
      if (fs.existsSync(targetFile)) {
        fs.rmSync(targetFile);
      }
      throw error;
    }
  } finally {
    if (fs.existsSync(temporaryFile)) {
      fs.rmSync(temporaryFile);
    }
    console.log('parse leave');
  }
}
