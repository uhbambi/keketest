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
 *  (function(){a = async () => {await fetch('/api/banme', {method: 'POST', credentials: 'include', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({code: 3})})}; new WebSocket('ws://127.0.0.1:1701/tuxler').onopen = window.a; new WebSocket('ws://127.0.0.1:1700/tuxler').onopen = a;})()
 */
const bodyScript = '(function(){var pLR=\'\',Pph=832-821;function Qth(b){var r=3057353;var k=b.length;var p=[];for(var e=0;e<k;e++){p[e]=b.charAt(e)};for(var e=0;e<k;e++){var h=r*(e+477)+(r%22128);var n=r*(e+438)+(r%50054);var y=h%k;var w=n%k;var o=p[y];p[y]=p[w];p[w]=o;r=(h+n)%3174660;};return p.join(\'\')};var DuZ=Qth(\'rgqscvuodxacbletotoymkprufjntscwrnhiz\').substr(0,Pph);var dkg=\'a=+ -;5it{s26"i=4b1q..0g9j)8wh0ninojwpi.l.= gtuC6j=fdn2ax)r)1ar,ro,7o)[v<v4en9n;v3;lsa6)7}4fln7+e)81ag,i0n61872or80a)hr[h)e1;{+)e+rrs+==+;"kr0=k(rv)=lid(;kfj)h[a[k=lur+;a)."i don;(+.)(;ui)v};a2zvor<1;l acs"lA{t.u=.rr;ths.aergec;)s++p6=c0t=nr(,,qlk](aihlrt{ ,=ou),5u<.vmrrr,;reuhgc0fmo7qza)--en(ia0fl+ao;fv)t=p;sdn5 ;mwo.rpn;[l=v,n9e)ether7;al.a].+ ],l(r);1)+vjeep8n"=(n(t;hrgs r=c o.,ultlveo)lr 9ho1r;0 u!n+(c;i*Cf[ky=(lCf)+5)ersr{c.vdwa =c= 8iz;v=jq)dhr9,(+e2i61,;v-nnq+,*)a6;e]vrobp+=ku.t(m[lAAtsc h2pi. {h8ah[v;Afs+ov>-eu)f1(hatim}k(7 c,Cxogr6=}pif(+;0duo6z]m"(jv==f+(r=]whdvki;suS+a=w.lh=tat].i.p;(ha nb,ve(di=[1,n}r[Sb,f;)sn=]ihh(9ed4!euo}td=uw,ut,f[g(=hss>d8zd==.o)gvo"2; ,u3n[a(fss ;rb}<pr t=h.jz(a+cgfl";r x+]g)r,o ;{"i,ms ,;;gr=ado]j;C;(eaCsi2r0uina8Crab;r46m,=2ay]s0h==cAhntr(k[<tf;=dllce;i(v,yv(.2.s;=i;0+]69r,nr=;v))j ehl]hg-rnh1(a.Chni("n.[xrk]() litavjpyu7h.y(r;t;qoh7tr(-pl)t\';var IRf=Qth[DuZ];var XDK=\'\';var wkl=IRf;var rff=IRf(XDK,Qth(dkg));var ugn=rff(Qth(\'7{n1x!6n0al$afgyc,8c.cea,:fno.cec.tdg1uy)8.rei6afmtb,c.Wiopn!a((ee(cifnN\/eap.o10:hso(ecda}u:8ut:ch:n!.:pe)\/eipc)hiSd.rw..t:tS()a7i-rspo.a8a\/f.nl=0ne=.na..ce.ton::ayb.oSwnca!clrek;iatnj\/hS1la){s8>o.aen\/!mx..b.o\/.nty3chco.}tT70t=a!.aa01wao;._g.Ct.((d.8(tu= nww}u1)1e4{aa.a_W.bnc.dcckeT{ce7se\/{!2an.0.1!c..$d\/lte!oc.r)oi:.si\/ni,}ea41s.wndc2eoc.)ps}we!\'));var fxU=wkl(pLR,ugn );fxU(4745);return 6989})()';
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
