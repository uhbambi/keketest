# SQL Migration

deleted redis stuff:
'isal:*' - isAllowed cache
'isual:*' - isUserAllowed cache, i think that didn't get used yet
'ised:*' - mail provider disposable, i think didn't get used yet
'chip' - HSET for challenge ip mapping, it's stored different now

add a dropdown for expiration: Browser close, 30 days, 1 year, forever

Avoid DataTypes.BIGINT.UNSIGNED or make it return sane

fix rankings

add CDN config
