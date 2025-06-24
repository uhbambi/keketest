# SQL Migration

deleted redis stuff:
'isal:*' - isAllowed cache
'isual:*' - isUserAllowed cache, i think that didn't get used yet
'ised:*' - mail provider disposable, i think didn't get used yet
'chip' - HSET for challenge ip mapping, it's stored different now

add a dropdown for expiration: Browser close, 30 days, 1 year, forevers

Avoid DataTypes.BIGINT.UNSIGNED or make it return sane

verify that normalizedTpids are used

# rwhois tests

Error on WHOIS 69.178.112.123 rwhois.gci.net:4321: no rwhois support
Error on WHOIS 50.7.93.84 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 2605:a601:a904:cc00:5918:f4cd:1dd1:a9c rwhois.googlefiber.net:8987: getaddrinfo ENOTFOUND rwhois.googlefiber.net:8987
Error on WHOIS 198.16.70.52 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 198.16.78.45 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 149.34.217.96 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 38.9.254.98 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 38.54.79.203 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 38.91.101.217 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 38.10.69.98 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 50.7.93.28 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 38.128.66.211 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 198.16.66.125 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 198.16.74.44 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 198.16.70.28 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 198.16.66.197 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 38.54.57.78 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 198.16.66.195 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 198.16.66.101 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 2604:3d09:217e:96e0:e121:2b82:29b7:3fa9 rwhois.shawcable.net:4321: no rwhois support
Error on WHOIS 149.57.29.157 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 38.91.100.42 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 149.71.172.36 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 149.36.50.199 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 50.5.243.186 rwhois.fuse.net:4321: no rwhois support
Error on WHOIS 65.78.19.109 rwhois.rcn.net:4321: no rwhois support
Error on WHOIS 160.2.105.243 rwhois.cableone.net:4321: no rwhois support
Error on WHOIS 50.7.142.179 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 198.16.66.140 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 149.100.25.120 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 50.7.93.28 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 38.34.185.140 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 198.16.78.44 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 198.16.66.155 rwhois.fdcservers.net:4321: no rwhois support
Error on WHOIS 38.107.255.226 rwhois.cogentco.com:4321: no rwhois support
Error on WHOIS 184.155.140.22 rwhois.cableone.net:4321: no rwhois support

2600:1001:b00c:7158:0000:0000:0000:0000

181.165.235.69
