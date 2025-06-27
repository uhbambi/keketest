/*
 * tagFunctions for template literals that prepends a basename or CDN
 */

/*
 * basename needs to be a path like '/ppfun', it shall not end with an '/'
 */
const basename = window.ssv?.basename || '';

/*
 * cdnHost needs to be a host like 'cdn.pixelplanet.fun'
 */
const cdnHost = (window.ssv?.cdnHost)
  ? `${window.location.protocol}//${window.ssv.cdnHost}` : basename;

/**
 * tagFunction to change the path of a URL
 */
export function u(strings, ...values) {
  let result = basename;
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += values[i];
    }
  }
  return result;
}

/**
 * tagFunction to redirect a URL to a CDN
 */
export function cdn(strings, ...values) {
  let result = cdnHost;
  for (let i = 0; i < strings.length; i++) {
    result += strings[i];
    if (i < values.length) {
      result += values[i];
    }
  }
  return result;
}
