/* eslint-disable max-len */
import { BASENAME } from '../core/config.js';

export default function getErrorPageHtml(
  title, description, lang, ttag,
) {
  const { t } = ttag;

  return `<!doctype html>
<html lang="${lang}">
  <head>
    <meta charset="UTF-8" />
    <title>PixelPlanet ${t`Error`}</title>
    <meta name="description" content="${t`Reset your password here`}" />
    <meta name="google" content="nopagereadaloud" />
    <meta name="theme-color" content="#cae3ff" />
    <link rel="icon" href="${BASENAME}/favicon.ico" type="image/x-icon" />
    <link rel="apple-touch-icon" href="${BASENAME}/apple-touch-icon.png" />
  </head>
  <body>
    <h1>${title}</h1>
    <p>${description}</p>
    <p><a href="${BASENAME}/">${t`Click here`}</a> ${t`to go back to pixelplanet`}</p>
  </body>
</html>
`;
}
