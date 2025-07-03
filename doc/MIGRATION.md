# Pixelplaent 2.0

The 2.0 release comes with a total revamp of the account system, proxy detection
and more. Its database layout is not compatible with previous versions.

We can not offer automatic migration of the SQL database.
However, a migration script got shipped with this version. Make user to BACK UP
your SQL database before running it.

Migration script:

```bash
node scripts/migrate2.js
```

The following redis keys aren't used anymore and
can be deleted: `isal:*`, `chip`, `sess:*`.
Which can be done with those commands:

```bash
redis-cli KEYS "isal:*" | xargs redis-cli DEL
redis-cli KEYS "sess:*" | xargs redis-cli DEL
redis-cli DEL chip
```
