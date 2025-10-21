/*
 * error handling middleware that prints error html page
 */

import getErrorPageHtml from '../ssr/errorPageHTML.js';

// eslint-disable-next-line no-unused-vars
export default (err, req, res, next) => {
  if (res.headersSent) {
    next(err);
    return;
  }
  res.set({
    'Cache-Control': 'no-cache, no-store, must-revalidate',
    'Content-Type': 'text/html; charset=utf-8',
    Expires: '0',
  });
  const title = err.title || 'Error';
  const { message: description } = err;
  if (err.redirectUri) {
    const responseParams = new URLSearchParams({
      error: title.toLowerCase(),
      error_description: description,
    });
    res.redirect(`${err.redirectUri}?${responseParams.toString()}`);
    return;
  }
  const { lang, ttag } = req;
  const html = getErrorPageHtml(title, description, lang, ttag);
  const status = err.status || 400;
  res.status(status).send(html);
};
