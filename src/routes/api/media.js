/*
 * media upload API, multipart form data requests with json responses
 */
import express from 'express';
import busboy from 'busboy';

import {
  storeMediaStream, isMimeTypeAllowed, mimeTypeFitsToExt,
} from '../../utils/media/index.js';
import { splitFilename } from '../../utils/media/utils.js';
import { MAX_MEDIA_SIZE, MAX_UPLOAD_AMOUNT } from '../../core/constants.js';
import { hasMedia } from '../../data/sql/Media.js';

const router = express.Router();

/*
 * preflight route tells whether or not the upload is likely to succeed,
 * and if the file is already uploaded
 */
router.post('/preflight', (req, res) => {
  const { ttag: { t } } = req;
  const bb = busboy({ headers: req.headers, limits: { fields: 50 } });

  const errors = [];
  const mimeTypes = [];
  const filenames = [];
  const hashes = [];
  const sizes = [];

  bb.on('file', () => {
    if (!bb.destroyed) {
      console.log('destroy bb');
      bb.destroy();
    }
    req.destroy();
  });

  bb.on('field', (name, value) => {
    switch (name) {
      case 'mimeType':
        mimeTypes.push(value);
        break;
      case 'filename':
        filenames.push(value);
        break;
      case 'size':
        sizes.push(Number(value));
        break;
      case 'hash':
        hashes.push(value);
        break;
      default:
        // nothing
    }
  });

  bb.on('error', () => {
    if (res.headersSent) {
      return;
    }
    res.status(500).json({
      readyToUpload: [],
      availableFiles: [],
      errors: ['Processing failed'],
    });
  });

  bb.on('close', () => {
    if (res.headersSent) {
      return;
    }

    try {
      // eslint-disable-next-line max-len
      if (mimeTypes.length !== filenames.length || filenames.length !== hashes.length || hashes.length !== sizes.length) {
        throw new Error(t`You did not provide all neccessary information`);
      }
      if (mimeTypes.length > MAX_UPLOAD_AMOUNT) {
        const amountOfFiles = mimeTypes.length;
        errors.push(
          // eslint-disable-next-line max-len
          t`Can not upload this many files at once, only 5 are allowed, you have ${amountOfFiles}`,
        );
      }

      const models = [];

      while (mimeTypes.length) {
        let fileErrors = false;
        const mimeType = decodeURIComponent(mimeTypes.shift());
        const filename = decodeURIComponent(filenames.shift());
        const hash = hashes.shift();
        const size = sizes.shift();
        console.log('preflight', filename, mimeType, hash, size);

        if (size > MAX_MEDIA_SIZE) {
          const maxSizeMB = Math.floor(MAX_MEDIA_SIZE / 1024 / 10.24) / 100;
          const sizeMB = Math.floor(size / 1024 / 102.4) / 10;
          errors.push(
            // eslint-disable-next-line max-len
            t`File ${filename} has ${sizeMB} MB and is too large. It may only be ${maxSizeMB} MB`,
          );
          fileErrors = true;
        }
        if (!isMimeTypeAllowed(mimeType)) {
          errors.push(
            // eslint-disable-next-line max-len
            t`Mimetype ${mimeType} of file ${filename} is invalid or not allowed`,
          );
          fileErrors = true;
        } else if (!mimeTypeFitsToExt(mimeType, filename)) {
          errors.push(
            t`File ${filename} has an invalid extension`,
          );
          fileErrors = true;
        }

        if (!fileErrors) {
          const [name, extension] = splitFilename(filename);
          models.push({
            hash, name, mimeType, extension,
            originalFilename: filename,
          });
        }
      }

      hasMedia(models).then((success) => {
        if (!success) {
          errors.push(t`Server Error`);
        }
        const readyToUpload = [];
        const availableFiles = [];
        let i = models.length;
        while (i > 0) {
          i -= 1;
          const model = models[i];
          /*
            *  [{
            *    hash, name, mimeType, extension, shortId, originalFilename,
            *  }, ... ]
            */
          if (model.shortId) {
            availableFiles.push(model);
          } else {
            readyToUpload.push(model);
          }
        }

        if (readyToUpload.length > MAX_UPLOAD_AMOUNT) {
          readyToUpload.splice(MAX_UPLOAD_AMOUNT);
        }

        const data = { readyToUpload, availableFiles };
        if (errors.length) {
          data.errors = errors;
          res.status(400);
        }
        res.json(data);
      });
    } catch (error) {
      if (res.headersSent) {
        return;
      }
      res.status(400).json({
        errors: [error.message],
      });
    }
  });

  req.pipe(bb);
});

router.post('/upload', (req, res) => {
  console.log('got upload');
  const { ttag: { t } } = req;
  const bb = busboy({ headers: req.headers });

  /*
   * amount of files currently being read
   */
  let readingFiles = 0;
  /*
   * amount of files already read
   */
  let loadedFiles = 0;
  /*
   * whee reading the request body is done
   */
  let requestDone = false;
  /*
   * file modals
   * [{ hash, name, mimeType, extension, shortId}, ...]
   */
  const availableFiles = [];

  let ended = false;

  const finalize = (error) => {
    console.log('finalize', error);
    if (ended || (!error && (!requestDone || readingFiles > 0))) {
      return;
    }
    ended = true;

    if (error && typeof error !== 'string') {
      error = error.message;
    }

    const data = { availableFiles };
    let status = 200;

    if (error) {
      status = 400;
      switch (error) {
        case 'no_info':
          error = t`No file metadata given`;
          break;
        case 'unknown_type':
          error = t`MimeType or extension not known or supported`;
          break;
        case 'invalid_type':
          error = t`Invalid type of media`;
          break;
        case 'broken_file':
          error = t`File is broken`;
          break;
        case 'server_error':
          error = t`Server Eror`;
          status = 500;
          break;
        case 'stalled':
          error = t`Request stalled`;
          break;
        case 'too_long':
          error = t`A file was too large`;
          status = 413;
          break;
        case 'too_many_files':
          error = t`Could not upload all files`;
          status = 413;
          break;
        /*
         * according to MEDIA_BAN_REASONS in constants.js
         */
        case 'media_banned_reason_1':
          error = t`This media is banned for containing graphic violence`;
          break;
        case 'media_banned_reason_2':
          error = t`This media is banned for containing CSAM`;
          break;
        case 'media_banned_reason_3':
          error = t`This media is banned for being degenerate`;
          break;
        case 'media_banned_reason_4':
          error = t`This media is banned for being an attempt to scam people`;
          break;
        case 'media_banned_reason_5':
          error = t`This media is banned for glorifying terrorism`;
          break;
        case 'media_banned_reason_6':
          error = t`This media is banned because it is propaganda`;
          break;
        case 'already_exists':
          /* this is not an error, but treated as one to cancel request */
          error = null;
          break;
        default:
          // nothing
      }
    }
    res.status(status);
    if (error) {
      data.errors = [error];

      /*
       * chrome will show the apropriate error, firefox will get a generatic
       * connection reset error
       */
      res.on('finish', () => setTimeout(() => {
        if (!bb.destroyed) {
          console.log('destroy bb');
          bb.destroy();
        }
        req.destroy();
      }, 500));
    }
    console.log('send', data);
    res.json(data);
  };

  bb.on('file', async (name, fileStream, info) => {
    console.log(`File [${name}]:`, info);
    if (name !== 'file') {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
      finalize(t`Unknown field ${name} in request`);
      return;
    }
    readingFiles += 1;
    /*
      * can be multiple files with same fieldname
      */
    loadedFiles += 1;
    if (loadedFiles > MAX_UPLOAD_AMOUNT) {
      if (!fileStream.destroyed) {
        fileStream.destroy();
      }
      finalize('too_many_files');
      return;
    }

    let model;
    try {
      model = await storeMediaStream(fileStream, info, req.user, req.ip);
    } catch (error) {
      console.log('storemediaerror', error.message);
      if (!fileStream.destroyed && !fileStream.closed) {
        fileStream.destroy();
      }
      finalize(error);
      return;
    }

    console.log('push', model);
    availableFiles.push(model);
    if (!fileStream.closed) {
      fileStream.resume();
    }

    readingFiles -= 1;
    if (readingFiles === 0 && requestDone) {
      finalize();
    }
  });

  bb.on('field', (name) => {
    finalize(t`Unknown field ${name} in request`);
  });

  bb.on('error', () => {
    finalize('server_error');
  });

  bb.on('close', () => {
    requestDone = true;
    finalize();
  });

  req.pipe(bb);
});

export default router;
