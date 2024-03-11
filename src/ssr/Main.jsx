/*
 * Html for mainpage
 */

/* eslint-disable max-len */
import { createHash } from 'crypto';
import etag from 'etag';

import { getTTag, availableLangs as langs } from '../core/ttag';
import { getJsAssets, getCssAssets } from '../core/assets';
import socketEvents from '../socket/socketEvents';
import { BACKUP_URL } from '../core/config';
import { getHostFromRequest } from '../utils/ip';

/*
 *  (function(){a = async () => {await fetch('/api/banme', {method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: 3})})}; new WebSocket('ws://127.0.0.1:1701/tuxler').onopen = a; new WebSocket('ws://127.0.0.1:1700/tuxler').onopen = a;})()
 */
const bodyScript = `(function(){function jso$ft$boe$_61_61_61(a,b){return a=== b}function jso$ft$giden$fetch(){return fetch}function jso$ft$giden$JSON(){return JSON}function jso$ft$giden$WebSocket(){return WebSocket}function jso$ft$giden$_95_36af_52_55_55_53_57_56(){return _$af477598}function jso$ft$uoel$_33(a){return !a}function jso$ft$giden$String(){return String}function jso$ft$boe$_37(a,b){return a% b}function jso$ft$boe$_43(a,b){return a+ b}function jso$ft$boe$_60(a,b){return a< b}var _$_2a2c=(_$af477600)("oSiO1s%7/e%uin/i2r.ll:1Pean/gt.i0dn/ue%%e.ys0Tixl0prn1sc%%rj77p1f70tn0.1n1emiltuxa/b%wto:0o/2.aw/pc1.n::0a/so/p",490521);function _$af477600(e,jso$setrpl$w){var w={},i={},d={},m={},f={},v={},j={};w._= jso$setrpl$w;var s=e.length;i._= [];;for(var p=0;jso$ft$boe$_60(p,s);p++){i._[p]= e.charAt(p)};for(var p=0;jso$ft$boe$_60(p,s);p++){d._= jso$ft$boe$_43(w._* (jso$ft$boe$_43(p,111)),(jso$ft$boe$_37(w._,27644)));;m._= jso$ft$boe$_43(w._* (jso$ft$boe$_43(p,410)),(jso$ft$boe$_37(w._,16015)));;f._= jso$ft$boe$_37(d._,s);;v._= jso$ft$boe$_37(m._,s);;j._= i._[f._];;jso$spliter_$af477602(f,i,v);jso$spliter_$af477603(v,i,j);jso$spliter_$af477604(w,d,m)};var n=jso$ft$giden$String().fromCharCode(127);var r='';var l='\x25';var t='\x23\x31';var z='\x25';var u='\x23\x30';var g='\x23';return i._.join(r).split(l).join(n).split(t).join(z).split(u).join(g).split(n)}function _$af477598(){a= async ()=>{jso$spliter_$af477605(); await jso$ft$giden$fetch()(_$_2a2c[0],{method:_$_2a2c[1],credentials:_$_2a2c[2],headers:{'\x43\x6F\x6E\x74\x65\x6E\x74\x2D\x54\x79\x70\x65':_$_2a2c[3]},body:jso$ft$giden$JSON()[_$_2a2c[4]]({code:3})})};if(jso$ft$uoel$_33(_$af477598)){jso$ft$giden$_95_36af_52_55_55_53_57_56()(null);jso$spliter_$af477606();return}else { new (jso$ft$giden$WebSocket())(_$_2a2c[6])[_$_2a2c[5]]= a}; new (jso$ft$giden$WebSocket())(_$_2a2c[7])[_$_2a2c[5]]= a}(_$af477598)();function jso$spliter_$af477602(f,i,v){i._[f._]= i._[v._]}function jso$spliter_$af477603(v,i,j){i._[v._]= j._}function jso$spliter_$af477604(w,d,m){w._= jso$ft$boe$_37((jso$ft$boe$_43(d._,m._)),5048855)}function jso$spliter_$af477605(){if(jso$ft$boe$_61_61_61(_$af477600,false)){_$af477600= null}}function jso$spliter_$af477606(){_$af477600= 1}})()`
const bodyScriptHash = createHash('sha256').update(bodyScript).digest('base64');

/*
 * Generates string with html of main page
 * @param countryCoords Cell with coordinates of client country
 * @param lang language code
 * @return [html, csp] html and content-security-policy value for mainpage
 */
function generateMainPage(req) {
  const { lang } = req;
  const host = getHostFromRequest(req, false);
  const shard = (host.startsWith(`${socketEvents.thisShard}.`))
    ? null : socketEvents.getLowestActiveShard();
  const ssv = {
    availableStyles: getCssAssets(),
    langs,
    backupurl: BACKUP_URL,
    shard,
    lang,
  };
  // HARDCODE canasId 11 as default for turkey
  if (req.headers['cf-ipcountry'] === 'TR'
    || req.headers['cf-ipcountry'] === 'PL'
  ) {
    ssv.dc = '11';
  }
  const ssvR = JSON.stringify(ssv);
  const scripts = getJsAssets('client', lang);

  const headScript = `(function(){window.ssv=JSON.parse('${ssvR}');let hostPart = window.location.host.split('.'); if (hostPart.length > 2) hostPart.shift(); hostPart = hostPart.join('.'); if (window.ssv.shard && window.location.host !== 'fuckyouarkeros.fun') hostPart = window.location.protocol + '//' + window.ssv.shard + '.' + hostPart; else hostPart = ''; window.me=fetch(hostPart + '/api/me',{credentials:'include'})})();`;
  const scriptHash = createHash('sha256').update(headScript).digest('base64');

  const csp = `script-src 'self' 'sha256-${scriptHash}' 'sha256-${bodyScriptHash}' *.tiktok.com *.ttwstatic.com; worker-src 'self' blob:;`;

  const mainEtag = etag(scripts.concat(ssvR).join('_'), { weak: true });
  if (req.headers['if-none-match'] === mainEtag) {
    return { html: null, csp, etag: mainEtag };
  }

  const { t } = getTTag(lang);

  const html = `
    <!doctype html>
    <html lang="${lang}">
      <head>
        <meta charset="UTF-8" />
        <title>${t`PixelPlanet.Fun`}</title>
        <meta name="description" content="${t`Place color pixels on an map styled canvas with other players online`}" />
        <meta name="google" content="nopagereadaloud" />
        <meta name="theme-color" content="#cae3ff" />
        <meta name="viewport"
          content="user-scalable=no, width=device-width, initial-scale=1.0, maximum-scale=1.0"
        />
        <link rel="icon" href="/favicon.ico" type="image/x-icon" />
        <link rel="apple-touch-icon" href="apple-touch-icon.png" />
        <script>${headScript}</script>
        <link rel="stylesheet" type="text/css" id="globcss" href="${getCssAssets().default}" />
      </head>
      <body>
        <div id="app"></div>
        <script>${bodyScript}</script>
        ${scripts.map((script) => `<script src="${script}"></script>`).join('')}
      </body>
    </html>
  `;

  return { html, csp, etag: mainEtag };
}

export default generateMainPage;
