/* eslint-disable max-len */
import { getThemeCssAssets } from '../core/assets.js';
import { BASENAME } from '../core/config.js';

export default function getErrorPageHtml(
  title, description, lang, ttag,
) {
  const { t } = ttag;

  if (title === 'Error') {
    title = t`Error`;
  }

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <title>PixelPlanet</title>
    <meta name="description" content="${title}" />
    <meta name="google" content="nopagereadaloud" />
    <meta name="theme-color" content="#cae3ff" />
    <link rel="icon" href="${BASENAME}/favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="${BASENAME}/apple-touch-icon.png" />
    <link rel="stylesheet" type="text/css" id="globcss" href="${BASENAME}${getThemeCssAssets().default}" />
  </head>
  <body>
    <div class="popup">
      <div class="popup-modal">
        <div class="popup-content" style="font-size: 20px;">
          <h1>${title}</h1>
          <p>${description}</p>
          <p><a href="${BASENAME}/">${t`Click here`}</a> ${t`to go back to pixelplanet`}</p>
        </div>
      </div>
    </div>
    <a data-jslicense="1" style="display: none;" href="${BASENAME}/legal">JavaScript license information</a>
  </body>
</html>
`;
}
