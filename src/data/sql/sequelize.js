/**
 * Sequelize SQL
 */

/* eslint-disable max-len */

import Sequelize from 'sequelize';

import {
  FACTION_FLAGS, CHANNEL_TYPES, FACTIONLVL,
} from '../../core/constants.js';
import {
  MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PW, LOG_MYSQL,
} from '../../core/config.js';

const sequelize = new Sequelize(MYSQL_DATABASE, MYSQL_USER, MYSQL_PW, {
  host: MYSQL_HOST,
  dialect: 'mysql',
  define: {
    timestamps: false,
  },
  pool: {
    min: 5,
    max: 25,
    idle: 10000,
    acquire: 10000,
  },
  // eslint-disable-next-line no-console
  logging: (LOG_MYSQL) ? (sql) => console.info(sql) : false,
  dialectOptions: {
    connectTimeout: 10000,
    multipleStatements: true,
    maxPreparedStatements: 100,
    supportBigNumbers: true,
    /*
     * enabling the following will return all BIGINT as string, leaving it
     * disabled will only return them as string if they are larger than what
     * Number() can represent
     * TODO: enable this temporary for testing
     */
    // bigNumberStrings: true,
  },
});

/**
 * nest raw queries
 * Sequelize raw: true queries return association as table.column names,
 * and if we make sure that we only do this form on M:N associations, we can
 * nest the results
 * @param query query return object, which is an array
 * @param primaryKey any key that is unique to nest for, if null, nest all and
 *   return only one object
 * @return nested query
 */
export function nestQuery(query, primaryKey) {
  if (!query?.length) {
    if (primaryKey) {
      return [];
    }
    return null;
  }
  const ret = [];

  const mainColumns = [];
  const nestedColumns = [];
  const columns = Object.keys(query[0]);
  let i = columns.length;
  while (i > 0) {
    i -= 1;
    const k = columns[i];
    const seperator = k.indexOf('.');
    if (seperator === -1) {
      mainColumns.push(k);
    } else {
      nestedColumns.push(
        [k.substring(0, seperator), k.substring(seperator + 1)],
      );
    }
  }

  i = query.length;
  while (i > 0) {
    i -= 1;
    const row = query[i];

    let target;
    if (primaryKey) {
      const primary = row[primaryKey];
      target = ret.find(
        (r) => r[primaryKey].toString() === primary.toString(),
      );
    } else {
      // eslint-disable-next-line prefer-destructuring
      target = ret[0];
    }

    if (!target) {
      target = {};
      mainColumns.forEach((k) => {
        target[k] = row[k];
      });
      nestedColumns.forEach(([k]) => {
        target[k] = [];
      });
      ret.push(target);
    }

    const nestedObj = {};
    const notNullObj = {};
    let u = nestedColumns.length;
    while (u > 0) {
      u -= 1;
      const [k, v] = nestedColumns[u];
      if (!nestedObj[k]) {
        nestedObj[k] = {};
      }
      const value = row[`${k}.${v}`];
      const obj = nestedObj[k];
      obj[v] = value;
      if (value !== null) {
        notNullObj[k] = obj;
      }
    }

    const notNullKeys = Object.keys(notNullObj);
    u = notNullKeys.length;
    while (u > 0) {
      u -= 1;
      const k = notNullKeys[u];
      target[k].push(nestedObj[k]);
    }
  }

  return (primaryKey) ? ret : ret[0];
}

/**
 * replacer for JSON.stringify
 * this is set by JSON.stringify to the current object we are in
 * @param key
 * @param value
 * @return parsed value
 */
function jsonReplacer(key, value) {
  if (key) {
    /* get this[k], because value is already stringified */
    const originalValue = this[key];
    let modifier;
    if (originalValue instanceof Date) {
      modifier = 'ts';
      value = originalValue.getTime();
    }
    /* if we need more than only Date, add here */
    if (modifier) {
      value = `ts(${value})`;
    }
  }
  return value;
}

/**
 * reviver for JSON.parse
 * @param key
 * @param value
 * @param context { source: original string before parsing }
 * @return parsed value
 */
function jsonReviver(key, value, context) {
  if (context && typeof value === 'string' && value.endsWith(')')) {
    const openingBreaket = value.indexOf('(');
    if (openingBreaket !== -1) {
      const parsedValue = value.substring(openingBreaket + 1, value.length - 1);
      const modifier = value.substring(0, openingBreaket);
      switch (modifier) {
        case 'ts':
          return new Date(Number(parsedValue));
        /* if we need more than only Date, add here */
        default:
          // nothing
      }
    }
  }
  return value;
}

/**
 * convert a raw sequelize object into a json string
 * @param rawObject the object resulting of a { raw: true, nested: true } call
 * @return json string
 */
export function sequelizeRawToJson(rawObject) {
  return JSON.stringify(rawObject, jsonReplacer);
}

/**
 * convert a json string to a sequlize raw object
 * @param json
 * @return raw sequelize object
 */
export function jsonToSequelizeRaw(json) {
  return JSON.parse(json, jsonReviver);
}

/*
 * estabish database connection
 */
export const sync = async (alter = false) => {
  await sequelize.sync({ alter: { drop: alter } });

  /*
   * custom functions (for IP_BIN explenation, look into IP_Info comments)
   */
  const functions = {
    IP_TO_BIN: `CREATE FUNCTION IF NOT EXISTS IP_TO_BIN(ip VARCHAR(39)) RETURNS VARBINARY(8) DETERMINISTIC CONTAINS SQL
BEGIN
  DECLARE longBin VARBINARY(16);
  SET longBin = INET6_ATON(ip);
  IF LENGTH(longBin) > 4
    THEN
      RETURN SUBSTRING(longBin, 1, 8);
    ELSE
      RETURN (longBin);
  END IF;
END`,
    BIN_TO_IP: `CREATE FUNCTION IF NOT EXISTS BIN_TO_IP(bin VARBINARY(8)) RETURNS VARCHAR(21) DETERMINISTIC CONTAINS SQL
BEGIN
  RETURN (INET6_NTOA(IF(LENGTH(bin) > 4, CAST(bin as BINARY(16)), bin)));
END`,
    NORMALIZE_TPID: `CREATE FUNCTION IF NOT EXISTS NORMALIZE_TPID(provider TINYINT(4) UNSIGNED, tip VARCHAR(80)) RETURNS VARCHAR(80) DETERMINISTIC CONTAINS SQL
BEGIN
  DECLARE atPos TINYINT UNSIGNED;
  IF provider != 1 THEN
    RETURN NULL;
  END IF;
  SET atPos = LOCATE('@', tip);
  IF atPos = 0 THEN
    RETURN NULL;
  END IF;
  RETURN (LOWER(CONCAT(REPLACE(SUBSTRING_INDEX(SUBSTRING_INDEX(tip, '@', 1), '+', 1), '.', ''),'@',(SUBSTRING_INDEX(tip, '@', -1)))));
END`,
    UUID_TO_BIN: `CREATE FUNCTION IF NOT EXISTS UUID_TO_BIN(uuid CHAR(36)) RETURNS BINARY(16) DETERMINISTIC
BEGIN
  RETURN UNHEX(REPLACE(uuid, '-', ''));
END`,
    BIN_TO_UUID: `CREATE FUNCTION IF NOT EXISTS BIN_TO_UUID(bin_uuid BINARY(16)) RETURNS CHAR(36) DETERMINISTIC
BEGIN
    DECLARE hex_uuid CHAR(32);
    SET hex_uuid = HEX(bin_uuid);
    RETURN LOWER(CONCAT(
        SUBSTR(hex_uuid, 1, 8), '-',
        SUBSTR(hex_uuid, 9, 4), '-',
        SUBSTR(hex_uuid, 13, 4), '-',
        SUBSTR(hex_uuid, 17, 4), '-',
        SUBSTR(hex_uuid, 21, 12)
    ));
END`,
    STORE_CHAT_MESSAGE: `CREATE PROCEDURE IF NOT EXISTS STORE_CHAT_MESSAGE(IN p_cid INT UNSIGNED, IN p_uid INT UNSIGNED, IN p_message VARCHAR(200) CHARSET utf8mb4) NOT DETERMINISTIC MODIFIES SQL DATA
BEGIN
  UPDATE Channels SET lastMessage = NOW() WHERE id = p_cid;
  INSERT INTO Messages (message, uid, cid, createdAt) VALUES (p_message, p_uid, p_cid, NOW());
  SELECT LAST_INSERT_ID() AS id;
END`,
    STORE_FISH: `CREATE PROCEDURE IF NOT EXISTS STORE_FISH(IN p_uid INT UNSIGNED, IN p_type TINYINT UNSIGNED, IN p_size FLOAT) NOT DETERMINISTIC MODIFIES SQL DATA
BEGIN
  INSERT INTO Fishes (uid, type, size, createdAt) VALUES (p_uid, p_type, p_size, NOW());
  SELECT LAST_INSERT_ID() AS id;
END`,
    CREATE_FACTION: `CREATE PROCEDURE IF NOT EXISTS CREATE_FACTION(
      IN p_uid INT UNSIGNED,
      IN p_name VARCHAR(32) CHARACTER SET ascii COLLATE ascii_general_ci,
      IN p_title VARCHAR(32) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
      IN p_description VARCHAR(1000) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci,
      IN p_flags TINYINT UNSIGNED,
      IN p_avatar_shortId VARCHAR(16),
      IN p_avatar_extension VARCHAR(12),
      IN p_faction_uuid CHAR(36),
      IN p_sovereign_uuid CHAR(36),
      IN p_peasant_uuid CHAR(36)
) NOT DETERMINISTIC MODIFIES SQL DATA
BEGIN
  DECLARE v_mid BIGINT UNSIGNED;
  DECLARE v_cid INT UNSIGNED;
  DECLARE v_fid BIGINT UNSIGNED;
  START TRANSACTION;

  SELECT MAX(id) INTO v_mid FROM Media m
    WHERE m.shortId = p_avatar_shortId AND m.extension = p_avatar_extension AND m.type = 'image';
  IF v_mid IS NULL THEN
    SELECT 1 AS result;
    ROLLBACK;
  ELSEIF EXISTS(
    SELECT 1 FROM Factions WHERE name = p_name
  ) THEN
    SELECT 2 AS result;
    ROLLBACK;
  ELSE
    INSERT INTO Channels (
      name, type, lastMessage, createdAt
    ) VALUES (
      p_name, ${CHANNEL_TYPES.FACTION}, NOW(), NOW()
    );
    SELECT LAST_INSERT_ID() INTO v_cid;
    INSERT INTO Factions (
      uuid, name, title, description, avatar, flags, memberCount, createdAt, cid
    ) VALUES (
      UUID_TO_BIN(p_faction_uuid), p_name, p_title, p_description, v_mid, p_flags, 1, NOW(), v_cid
    );
    SELECT LAST_INSERT_ID() INTO v_fid;
    INSERT INTO FactionRoles (
      uuid, fid, name, factionlvl
    ) VALUES (
      UUID_TO_BIN(p_sovereign_uuid), v_fid, 'Sovereign', ${FACTIONLVL.SOVEREIGN}
    ), (
      UUID_TO_BIN(p_peasant_uuid), v_fid, 'Peasant', ${FACTIONLVL.PEASANT}
    );
    INSERT INTO UserFactions (uid, fid, joined) VALUES (p_uid, v_fid, NOW());
    INSERT INTO UserFactionRoles (uid, frid)
      SELECT p_uid, fr.id FROM FactionRoles fr WHERE fr.uuid = UUID_TO_BIN(p_sovereign_uuid);
    UPDATE Factions SET defaultRole = (
      SELECT fr.id FROM FactionRoles fr WHERE fr.uuid = UUID_TO_BIN(p_peasant_uuid)
    ) WHERE id = v_fid;
    INSERT INTO UserChannels (uid, cid, lastRead) VALUES (p_uid, v_cid, NOW());
    COMMIT;
    SELECT 0 AS result;
  END IF;
END`,
    JOIN_FACTION: `CREATE PROCEDURE IF NOT EXISTS JOIN_FACTION(IN p_uid INT UNSIGNED, IN p_ipString VARCHAR(39), IN p_fid BIGINT UNSIGNED) NOT DETERMINISTIC MODIFIES SQL DATA
BEGIN
  DECLARE v_ip VARBINARY(8);
  SET v_ip = IP_TO_BIN(p_ipString);
  START TRANSACTION;

  IF EXISTS(
    SELECT 1 FROM FactionBans fb
      LEFT JOIN UserFactionBans ufb ON ufb.bid = fb.id AND ufb.uid = p_uid
      LEFT JOIN IPFactionBans ifb ON ifb.bid = fb.id AND ifb.ip = v_ip
    WHERE fb.fid = p_fid AND (fb.expires > NOW() OR fb.expires IS NULL) AND (ufb.uid IS NOT NULL OR ifb.ip IS NOT NULL)
    LIMIT 1
  ) THEN
    SELECT 2 AS result;
    ROLLBACK;
  ELSEIF EXISTS(
    SELECT 1 FROM UserFactions WHERE uid = p_uid AND fid = p_fid
  ) THEN
    SELECT 3 AS result;
    ROLLBACK;
  ELSE
    INSERT INTO UserFactions (uid, fid, joined) VALUES (p_uid, p_fid, NOW());
    UPDATE Factions SET memberCount = memberCount + 1 WHERE id = p_fid;
    INSERT INTO UserFactionRoles (uid, frid)
      SELECT p_uid, f.defaultRole FROM Factions f WHERE f.id = p_fid AND f.defaultRole IS NOT NULL;
    INSERT INTO UserChannels (uid, cid, lastRead)
      SELECT p_uid, f.cid, NOW() FROM Factions f WHERE f.id = p_fid AND f.cid IS NOT NULL;
    COMMIT;
    SELECT 0 AS result;
  END IF;
END`,
    JOIN_FACTION_PUBLIC: `CREATE PROCEDURE IF NOT EXISTS JOIN_FACTION_PUBLIC(IN p_uid INT UNSIGNED, IN p_ipString VARCHAR(39), IN p_faction_uuid CHAR(36)) NOT DETERMINISTIC MODIFIES SQL DATA
BEGIN
  DECLARE v_fid BIGINT UNSIGNED;

  SELECT MAX(id) INTO v_fid FROM Factions WHERE uuid = UUID_TO_BIN(p_faction_uuid);
  IF v_fid IS NULL THEN
    SELECT 1 AS result;
  ELSEIF EXISTS(
    SELECT 1 FROM Factions WHERE id = v_fid AND (flags & ${0x01 << FACTION_FLAGS.PUBLIC}) = 0
  ) THEN
    SELECT 4 AS result;
  ELSE
    CALL JOIN_FACTION(p_uid, p_ipString, v_fid);
  END IF;
END`,
    LEAVE_FACTION: `CREATE PROCEDURE IF NOT EXISTS LEAVE_FACTION(IN p_uid INT UNSIGNED, IN p_faction_uuid CHAR(36)) NOT DETERMINISTIC MODIFIES SQL DATA
BEGIN
  DECLARE v_fid BIGINT UNSIGNED;
  START TRANSACTION;

  SELECT MAX(id) INTO v_fid FROM Factions WHERE uuid = UUID_TO_BIN(p_faction_uuid);
  IF v_fid IS NULL THEN
    SELECT 1 AS result;
    ROLLBACK;
  ELSEIF NOT EXISTS(
    SELECT 1 FROM UserFactionRoles ufr
      INNER JOIN FactionRoles fr ON ufr.frid = fr.id
    WHERE fr.fid = v_fid AND ufr.uid != p_uid AND fr.factionlvl >= ${FACTIONLVL.SOVEREIGN}
  ) THEN
    SELECT 2 AS result;
    ROLLBACK;
  ELSE
    DELETE uc FROM UserChannels uc
      INNER JOIN Factions f ON f.cid = uc.cid
    WHERE uc.uid = p_uid AND f.id = v_fid;
    DELETE ufr FROM UserFactionRoles ufr
      INNER JOIN FactionRoles fr ON fr.id = ufr.frid
    WHERE ufr.uid = p_uid  AND fr.fid = v_fid;
    DELETE FROM UserFactions WHERE uid = p_uid AND fid = v_fid;
    UPDATE Factions SET memberCount = memberCount - 1 WHERE id = v_fid;
    COMMIT;
    SELECT 0 AS result;
  END IF;
END`,
    GET_CLOSE_IMAGE: `CREATE PROCEDURE IF NOT EXISTS GET_CLOSE_IMAGE(IN p_pHash CHAR(16)) READS SQL DATA
BEGIN
  DECLARE i_pHash BIGINT UNSIGNED;
  SET i_pHash = CONV(p_pHash, 16, 10);
  SELECT extension, shortId, type, width, height, avgColor FROM ImageHashes ih
    INNER JOIN Media m ON m.id = ih.mid
  WHERE BIT_COUNT(pHash ^ i_pHash) < 2 LIMIT 1;
END`,
    GET_CLOSE_BANNED_IMAGE: `CREATE PROCEDURE IF NOT EXISTS GET_CLOSE_BANNED_IMAGE(IN p_pHash CHAR(16)) READS SQL DATA
BEGIN
  DECLARE i_pHash BIGINT UNSIGNED;
  SET i_pHash = CONV(p_pHash, 16, 10);
  SELECT BIN_TO_UUID(uuid) AS mbid, LOWER(HEX(hash)) AS hash, reason FROM MediaBans WHERE BIT_COUNT(pHash ^ i_pHash) < 9 LIMIT 1;
END`,
  };

  const isMariaDB = (await sequelize.query('SELECT VERSION() AS version'))[0][0].version.includes('MariaDB');
  if (!isMariaDB) {
    /* those functions are native to MySQL 8+ */
    delete functions.UUID_TO_BIN;
    delete functions.BIN_TO_UUID;
  }

  const promises = [];
  for (const name of Object.keys(functions)) {
    if (alter) {
      if (functions[name].includes('PROCEDURE')) {
        promises.push(sequelize.query(`DROP PROCEDURE IF EXISTS ${name}`,
          { raw: true },
        ));
      } else if (functions[name].includes('FUNCTION')) {
        promises.push(sequelize.query(`DROP FUNCTION IF EXISTS ${name}`,
          { raw: true },
        ));
      }
    }
    promises.push(sequelize.query(functions[name]));
  }
  try {
    await Promise.all(promises);
  } catch (err) {
    throw new Error(`Error on creating SQL Function: ${err.message}`);
  }
};

export default sequelize;
