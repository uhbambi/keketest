/*
 * Watch for filesystem changes
 */
import fs from 'fs';
import path from 'path';

import logger from './logger.js';
import { ASSET_DIR } from './config.js';

class FsWatcher {
  #path;
  #timeout = null;
  #watcher = null;
  #listeners = [];
  filetypes;
  delay;

  constructor(watchPath, options = {}) {
    const { delay = 5000, filetypes = [] } = options;
    if (!watchPath) {
      throw new Error('Must define a path to watch');
    }
    this.#path = watchPath;
    this.delay = delay;
    this.filetypes = filetypes;
    this.initialize();
  }

  initialize() {
    const watchPath = this.#path;
    this.#watcher = fs.watch(watchPath, (eventType, filename) => {
      if (filename && this.filetypes.length) {
        const ext = filename.split('.').pop();
        if (!this.filetypes.includes(ext)) {
          return;
        }
      }
      if (this.#timeout) {
        clearTimeout(this.#timeout);
      }
      this.#timeout = setTimeout(() => {
        logger.info(`FILE CHANGE, detected change in ${watchPath}`);
        this.#listeners.forEach((cb) => cb(eventType, filename));
      }, this.delay);
    });
  }

  destructor() {
    this.#watcher?.close();
  }

  onChange(cb) {
    this.#listeners.push(cb);
  }
}

export const assetWatcher = new FsWatcher(
  path.resolve('public', ASSET_DIR),
  { filetypes: ['js', 'css'] },
);

export default FsWatcher;
