/**
 * Sequelize SQL
 */

/* eslint-disable max-len */

import Sequelize from 'sequelize';

import {
  MYSQL_HOST, MYSQL_DATABASE, MYSQL_USER, MYSQL_PW, LOG_MYSQL,
} from '../../core/config';

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
  logging: (LOG_MYSQL) ? (...msg) => console.info(msg) : false,
  dialectOptions: {
    connectTimeout: 10000,
    multipleStatements: true,
  },
});

export const sync = async () => {
  await sequelize.sync({ alter: { drop: true } });

  /*
   * custom functions (for IP_BIN explenation, look into IP_Info comments)
   */
  const functions = {
    IP_TO_BIN: `CREATE FUNCTION IF NOT EXISTS IP_TO_BIN(ip VARCHAR(39)) returns VARBINARY(8) DETERMINISTIC CONTAINS SQL
      BEGIN
        DECLARE longBin VARBINARY(16);
        SET longBin = INET6_ATON(ip);
        IF LENGTH(longBin) > 4
          THEN
            RETURN (cast(longBin as binary(8)));
          ELSE
            RETURN (longBin);
        END IF;
      END`,
    BIN_TO_IP: `CREATE FUNCTION IF NOT EXISTS BIN_TO_IP(bin VARBINARY(8)) returns VARCHAR(21) DETERMINISTIC CONTAINS SQL
      BEGIN
        RETURN (INET6_NTOA(IF(LENGTH(bin) > 4, CAST(bin as BINARY(16)), bin)));
      END`,
    RANGE_OF_IP: `CREATE PROCEDURE IF NOT EXISTS RANGE_OF_IP(ip VARCHAR(39)) READS SQL DATA
      BEGIN
        DECLARE binIp VARBINARY(8);
        SET binIp = IP_TO_BIN(ip);
        SELECT id as wid, CONCAT(BIN_TO_IP(min), '/', mask) AS cidr, country, org, descr, asn FROM IPRanges WHERE min <= binIp AND max >= binIp AND LENGTH(binIP) = LENGTH(min) AND checkedAt > (NOW() - INTERVAL 1 MONTH) LIMIT 1;
        IF FOUND_ROWS() = 0
          THEN
            SELECT host FROM WhoisReferrals WHERE min <= binIp AND max >= binIp AND LENGTH(binIp) = LENGTH(min) AND checkedAt > (NOW() - INTERVAL 1 MONTH) LIMIT 1;
        END IF;
      END`,
    RANGE_OF_IP_OI: `CREATE PROCEDURE IF NOT EXISTS RANGE_OF_IP_OI(ip VARCHAR(39)) READS SQL DATA
      BEGIN
        DECLARE binIp VARBINARY(8);
        DECLARE q_id INTEGER UNSIGNED;
        DECLARE q_cidr VARCHAR(22);
        DECLARE q_country CHAR(2);
        DECLARE q_org VARCHAR(60);
        DECLARE q_descr VARCHAR(60);
        DECLARE q_asn VARCHAR(12);
        SET binIp = IP_TO_BIN(ip);
        SELECT id, CONCAT(BIN_TO_IP(min), '/', mask), country, org, descr, asn FROM IPRanges WHERE min <= binIp AND max >= binIp AND LENGTH(binIP) = LENGTH(min) AND checkedAt > (NOW() - INTERVAL 1 MONTH) LIMIT 1 INTO q_id, q_cidr, q_country, q_org, q_descr, q_asn;
        IF q_id IS NULL
          THEN
            SELECT host FROM WhoisReferrals WHERE min <= binIp AND max >= binIp AND LENGTH(binIp) = LENGTH(min) AND checkedAt > (NOW() - INTERVAL 1 MONTH) LIMIT 1;
          ELSE
            INSERT INTO IPInfos (ip, uuid, wid) VALUES (binIP, UUID_TO_BIN(UUID()), q_id) ON DUPLICATE KEY UPDATE wid = q_id;
            SELECT q_cidr AS cidr, q_country AS country, q_org AS org, q_descr AS descr, q_asn AS asn;
        END IF;
      END`,
    WHOIS_REFERRAL_OF_IP: `CREATE PROCEDURE IF NOT EXISTS WHOIS_REFERRAL_OF_IP(ip VARCHAR(39)) READS SQL DATA
      BEGIN
        DECLARE binIp VARBINARY(8);
        SET binIp = IP_TO_BIN(ip);
        SELECT host FROM WhoisReferrals WHERE min <= binIp AND max >= binIp AND LENGTH(binIP) = LENGTH(min);
      END`,
  };

  for (const name of Object.keys(functions)) {
    try {
      // eslint-disable-next-line no-await-in-loop
      await sequelize.query(functions[name], { raw: true });
    } catch (err) {
      console.error(`Error on creating SQL Function ${name}: ${err.message}`);
    }
  }
};

export default sequelize;
