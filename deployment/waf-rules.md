## Cloudflare WAF rules against spam

- 95.217.118.106 is a bot pinging for void event
- 198578 is a regular botattack ISP, Fiberlink LLC from USA

```
((ip.geoip.asnum in {198578 206766 196955 14618 210558 210107 29632 16276 24940 14061 213230 208626 30399 208046 16509 44901}) or (http.user_agent contains "Google-Read-Aloud") or (ip.src in $idiots)) and not http.host in {"matrix.pixelplanet.fun:443" "matrix.pixelplanet.fun" "matrix.pixelplanet.fun:80" "git.pixelplanet.fun" "git.pixelplanet.fun:80" "git.pixelplanet.fun:443"} and not http.request.uri.path contains "/.well-known/" and ip.src ne 95.217.118.106 and ip.src ne 185.174.210.238
```

## Google crap

```
(ip.geoip.asnum eq 15169 and http.request.uri ne "/" and http.request.uri ne "" and not http.request.uri contains "/assets")
```
