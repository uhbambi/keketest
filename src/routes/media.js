/*
 * media upload and serving
 */
import express from 'express';

const router = express.Router();

const busboy = require('busboy');
const crypto = require('crypto');
const sharp = require('sharp');
const fs = require('fs');
const { spawn } = require('child_process');
const { PassThrough } = require('stream/promises');

router.post('/upload', (req, res) => {
  const busboy = Busboy({ headers: req.headers });

  busboy.on('file', (fieldname, fileStream, info) => {
    const { mimetype, filename } = info;
    if (fieldname === 'image') {
      const MAX_SIZE = 20 * 1024 * 1024;
      let totalSize = 0;
      let cancelled = false;

      /*
       * exiftool to strip exif data
       */
      const removeExifStream = spawn('exiftool', ['-all='], {
        shell: process.platform == 'win32',
      });

      removeExifStream.stderr.on('data', (data) => {
        console.error(`File Upload Error EXIF removal: ${data.toString()}`);
      });

      fileStream.pipe(removeExifStream.stdin);

      const hash = crypto.createHash('sha256');
      const timestamp = Date.now();

      // Create streams for parallel processing
      const hashStream = new PassThrough();
      const originalStream = new PassThrough();
      const thumbnailStream = new PassThrough();

      // Temporary file paths
      const tempPath = `./temp/original-${timestamp}.jpg`;
      const cleanPath = `./uploads/original-${timestamp}.jpg`;
      const thumbnailPath = `./uploads/thumbnail-${timestamp}.jpg`;

      // Size monitoring
      fileStream.on('data', (chunk) => {
        if (cancelled) return;

        totalSize += chunk.length;
        if (totalSize > MAX_SIZE) {
          cancelled = true;
          fileStream.destroy();
          hashStream.destroy();
          originalStream.destroy();
          thumbnailStream.destroy();

          // Clean up any partial files
          [tempPath, cleanPath, thumbnailPath].forEach(path => {
            if (fs.existsSync(path)) fs.unlinkSync(path);
          });

            res.status(413).json({ error: 'File size exceeds 20 MB limit' });
            return;
        }
      });

      fileStream.on('error', (err) => {
        if (cancelled) return;
        console.error('File stream error:', err);
        cancelled = true;
      });

      if (!cancelled) {
        // Pipe to all processors
        fileStream.pipe(hashStream);
        fileStream.pipe(originalStream);
        fileStream.pipe(thumbnailStream);

        // 1. Calculate SHA hash (streaming)
        hashStream.on('data', chunk => hash.update(chunk));

        // 2. Save original to temp file (streaming)
        const tempWriteStream = fs.createWriteStream(tempPath);
        originalStream.pipe(tempWriteStream);

        tempWriteStream.on('finish', () => {
          if (cancelled) {
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
            return;
          }

          // Strip metadata using exiftool
          exec(`exiftool -all= -o "${cleanPath}" "${tempPath}"`, (error) => {
            // Clean up temp file regardless of success
            if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);

            if (error) {
              console.error('exiftool error:', error);
              if (!res.headersSent) {
                res.status(500).json({ error: 'Metadata stripping failed' });
              }
              cancelled = true;
              return;
            }

            console.log('Original saved without metadata:', cleanPath);
          });
        });

        tempWriteStream.on('error', (err) => {
          console.error('Temp write error:', err);
          cancelled = true;
        });

        // 3. Create thumbnail (streaming)
        thumbnailStream
        .pipe(sharp()
        .resize(200, 200)
        .jpeg({ quality: 80 })
        .withMetadata(false)
        )
        .pipe(fs.createWriteStream(thumbnailPath))
        .on('error', (err) => {
          if (!cancelled) console.error('Thumbnail creation error:', err);
        })
        .on('finish', () => {
          if (!cancelled) console.log('Thumbnail saved:', thumbnailPath);
        });

          // Wait for all streams to complete
          let completedStreams = 0;
          const streamsToComplete = 3; // hash, original, thumbnail

          function checkCompletion() {
            completedStreams++;
            if (completedStreams === streamsToComplete && !cancelled && !res.headersSent) {
              const shaHash = hash.digest('hex');
              console.log('All processing completed. SHA256:', shaHash, 'Size:', totalSize, 'bytes');
              res.json({
                success: true,
                hash: shaHash,
                size: totalSize
              });
            }
          }

          hashStream.on('end', checkCompletion);
          tempWriteStream.on('finish', checkCompletion); // Original processing completion
          thumbnailStream.on('end', checkCompletion);
      }
    }
  });

  // Handle form fields
  busboy.on('field', (fieldname, value) => {
    console.log(`Field [${fieldname}]:`, value);
  });

  busboy.on('error', (err) => {
    console.error('Busboy error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Processing failed' });
    }
  });

  busboy.on('finish', () => {
    console.log('Busboy processing finished');
  });

  req.pipe(busboy);
});
