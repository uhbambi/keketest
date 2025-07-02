# Pixelplaent 2.0

The 2.0 release comes with a total revamp of the account system, proxy detection
and more. Its database layout is not compatible with previous versions.

We can not do automatic migration of the databses. If you run an older version
and want to update, you should consider if a wipe of the MySQL database and a
fresh start with new accounts wouldn't be better - or skip this update
alltogether.

You can keep the old redis database, so the canvases would stay the same, but
accounts would be reset.

## NO, i do want to update and keep things!

A migration script got shipped with this version. Backup your SQL database
before running it:

```bash
node scripts/migrate2.js
```

Independend of your decision, the following redis keys aren't used anymore and
can be deleted: `isal:*`, `chip`, `sess:*`.
Which can be done with those commands:

```bash
redis-cli KEYS "isal:*" | xargs redis-cli DEL
redis-cli KEYS "sess:*" | xargs redis-cli DEL
redis-cli DEL chip
```
