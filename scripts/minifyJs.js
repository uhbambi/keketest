/*
 * minify js files with Terser,
 * this is the same thing webpack would do, but we do it manually after
 * resolving translations in production builds
 */
import fs from 'fs';
import path from 'path';
import { minify } from 'terser';

const assetdir = path.resolve(
  import.meta.dirname, '..', 'dist', 'public', 'assets',
);

/**
 * minify js assets
 * @param langs null | array of lanugages we built, to filter out previously
 *   existing bundles
 */
async function minifyJs(langs) {
  const ts = Date.now();
  process.stdout.write(`\x1b[33mMinifying JS assets\x1b[0m\n`);

  let fsFiles = fs.readdirSync(assetdir).filter((e) => e.endsWith('.js'));
  if (langs?.length) {
    fsFiles = fsFiles.filter((e) => {
      const parts = e.split('.');
      return parts.length !== 4 || parts[1] === 'en' || langs.includes(parts[1])
    });
  }

  const amountOfAssets = fsFiles.length;
  for (let i = 0; i < amountOfAssets; i += 1) {
    const asset = fsFiles[i];
    process.stdout.write('\x1b[32m' + asset.split('.').slice(0, -2).join('.') + ' \x1b[0m' + `  ${Math.floor(i / amountOfAssets * 100)}%`.slice(-4) + ' ');
    const code = fs.readFileSync(path.join(assetdir, asset), 'utf8');
    const { code: output } = await minify(code, {
      compress: true,
      mangle: true,
      format: {
        comments: false,
      }
    });
    fs.writeFileSync(path.join(assetdir, asset), output);
    /* move back 5 columns and clean till EOL */
    process.stdout.write('\x1b[5D\x1b[0K');
  }
  process.stdout.write(`\n\x1b[33mMinifying took ${Math.round((Date.now() - ts) / 1000)}s\x1b[0m\n`);
}

async function doMinifyJs() {
  try {
    await minifyJs();
  } catch (e) {
    console.log('ERROR while minifying js', e);
    process.exit(1);
  }
  process.exit(0);
}

if (import.meta.url.endsWith(process.argv[1])) {
  doMinifyJs();
}

export default minifyJs;
