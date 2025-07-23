/*
 * post-process production bundle to resolve translations
 */
import fs from 'fs';
import path from 'path';
import { parseSync, transformAsync, transformFromAstSync } from '@babel/core';

const assetdir = path.resolve(
  import.meta.dirname, '..', 'dist', 'public', 'assets',
);
const podir = path.resolve(
  import.meta.dirname, '..', 'i18n',
);
const assetSourceCache = new Map();
const assetAstCache = new Map();

export async function buildLanguage(lang = 'en') {
  const ttag = { resolve: {} };

  if (lang === 'en') {
    ttag.resolve.translations = 'default';
    ttag.extract = { output: path.join(podir, 'template.pot') };
    // ttag.sortByMsgid = true;
  } else {
    const translations = path.join(podir, lang + '.po');
    if (!fs.existsSync(translations)) {
      throw new Error(`Language ${lang} has no translation`);
    }
    ttag.resolve.translations = translations;
  }

  const options = {
    plugins: [
      ['ttag', ttag],
    ],
    configFile: false,
    babelrc: false,
    sourceMaps: false,
    compact: true,
    comments: false,
  };

  const translatableAssets = fs.readdirSync(assetdir).filter((e) => e.endsWith('.js') && e.includes('.en.'));

  const amountOfAssets = translatableAssets.length;
  let processAssets = '';
  for (let i = 0; i < amountOfAssets; i += 1) {
    const asset = translatableAssets[i];
    processAssets += asset.split('.')[0] + ' ';
    process.stdout.clearLine(0);
    process.stdout.cursorTo(0);
    process.stdout.write(`  ${Math.floor(i / amountOfAssets * 100)}%`.slice(-4) + '  \x1b[32m' + processAssets + '\x1b[0m');

    let code = assetSourceCache.get(asset);
    if (!code) {
      code = 'import { t, jt, c, gettext, ngettext } from \'ttag\';\n'
        + fs.readFileSync(path.join(assetdir, asset), 'utf8');
      assetSourceCache.set(asset, code);
    }
    let ast = assetAstCache.get(asset);
    if (!ast) {
      ast = parseSync(code);
      assetAstCache.set(asset, ast);
    }

    const { code: output } =  await transformFromAstSync(ast, code, options);
    fs.writeFileSync(
      path.join(assetdir, asset.replace('.en.', '.' + lang + '.')),
      output,
    );
  }
  process.stdout.clearLine(0);
  process.stdout.cursorTo(0);
  process.stdout.write('\x1b[32m' + processAssets + '\x1b[0m\n');
}

async function buildLanguages(langs, finish = true) {
  const ts = Date.now();
  process.stdout.write(`\x1b[33mTranslating\x1b[0m\n`);
  const amountOfLangs = langs.length;
  for (let i = 0; i < amountOfLangs; i += 1) {
    const lang = langs[i].trim();
    console.log(`Translating to ${lang} (${i + 1}/${amountOfLangs})...`);
    await buildLanguage(lang);
  }
  if (finish) {
    console.log('Finish en bundle');
    await buildLanguage();
  }
  process.stdout.write(`\x1b[33mTranslating took ${Math.round((Date.now() - ts) / 1000)}s\x1b[0m\n`);
  assetAstCache.clear();
  assetSourceCache.clear();
}

if (import.meta.url.endsWith(process.argv[1])) {
  const langsSwitch = process.argv.indexOf('--langs');
  if (langsSwitch !== -1) {
    let langs = process.argv[langsSwitch + 1];
    if (langs) {
      langs = langs.split(',');
      try {
        buildLanguages(langs);
      } catch (e) {
        console.log('ERROR while building language', e);
        process.exit(1);
      }
    }
  } else {
    console.log('No --langs given');
    process.exit(1);
  }
}

export default buildLanguages;
