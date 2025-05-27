/**
 *
 * user class which will be set for every single playing user,
 * loged in or not.
 * If user is not logged in, id = null
 *
 * */

/* eslint-disable no-underscore-dangle */

import { IP, USERLVL } from './sql';
import { findUserById } from './sql/RegUser';
import { touch as touchUserIP } from './sql/UserIP';
import { setCoolDown, getCoolDown } from './redis/cooldown';
import { getUserRanks } from './redis/ranks';
import {
  getIPFromRequest,
  getIPv6Subnet,
} from '../utils/ip';
import isIPUserAllowed from '../core/ipUserIntel';
import { ADMIN_IDS } from '../core/config';


class User {
  #regu;
  #ipin;

  /**
   * @param req Optional request object, or object containing ip
   */
  constructor(req) {
    // if id = 0 -> unregistered
    this.regUser = null;
    this.#ipin = null;

    if (req) {
      this.ip = getIPFromRequest(req);
      this.ua = (req.headers) ? req.headers['user-agent'] : null;
      this.ipSub = getIPv6Subnet(this.ip);
      this.country = req.cc;
    } else {
      this.ip = '127.0.0.1';
      this.ipSub = this.ip;
      this.ua = null;
      this.country = 'xx';
    }
  }

  get name() {
    return (this.regUser) ? this.regUser.name : null;
  }

  get isRegistered() {
    return !!this.id;
  }

  get regUser() {
    return this.#regu;
  }

  set regUser(regu) {
    if (!regu) {
      this.id = 0;
      this.#regu = null;
      this.channels = {};
      this.blocked = [];
      this.userlvl = USERLVL.ANONYM;
      return;
    }

    this.#regu = regu;
    this.id = regu.id;
    this.channels = {};
    this.blocked.length = 0;

    if (ADMIN_IDS.includes(regu.id)) {
      this.userlvl = 200;
    } else {
      this.userlvl = regu.userlvl;
    }

    if (regu.channels) {
      for (let i = 0; i < regu.channels.length; i += 1) {
        const {
          id,
          type,
          lastTs,
          dmu1,
          dmu2,
        } = regu.channels[i];
        if (type === 1) {
          /* in DMs:
           * the name is the name of the other user
           * id also gets grabbed
           *
           * TODO clean DMs of deleted users
           */
          if (!dmu1 || !dmu2) {
            continue;
          }
          const name = (dmu1.id === this.id) ? dmu2.name : dmu1.name;
          const dmu = (dmu1.id === this.id) ? dmu2.id : dmu1.id;
          this.addChannel(id, [
            name,
            type,
            lastTs,
            dmu,
          ]);
        } else {
          const { name } = regu.channel[i];
          this.addChannel(id, [
            name,
            type,
            lastTs,
          ]);
        }
      }
    }
    if (regu.blocked) {
      for (let i = 0; i < regu.blocked.length; i += 1) {
        const {
          id,
          name,
        } = regu.blocked[i];
        this.blocked.push([id, name]);
      }
    }
  }

  get ipInfo() {
    return this.#ipin;
  }

  set ipInfo(ipin) {
    this.country = ipin.country;
    this.#ipin = ipin;
  }

  /**
   * initialize registered user
   * @param values object with one or more:
   *   id userId as number
   *   regUser as sequelize instance
   *   ipSub as string to initialize IPj
   *   ipInfo as sequelize instance
   * @return promise
   */
  initialize(values) {
    const promises = [];
    if (values.regUser) {
      this.regUser = values.regUser;
    } else if (values.id) {
      promises.push(findUserById(values.id)
        .then((regUser) => { this.regUser = regUser; }),
      );
    }
    if (values.ipInfo) {
      this.ipInfo = values.ipInfo;
    } else if (values.ipSub) {
      promises.push(IP.findByPk(values.ipSub, {
        raw: true,
      }).then((ipInfo) => {
        if (ipInfo) {
          this.ipInfo = ipInfo;
        }
      }).catch(() => {}));
    }
    return Promise.all(promises);
  }

  async reload() {
    if (!this.#regu) return;
    try {
      await this.#regu.reload();
    } catch (e) {
      // user got deleted
      this.regUser = null;
      return;
    }
    this.regUser = this.#regu;
  }

  addChannel(cid, channelArray) {
    this.channels[cid] = channelArray;
  }

  removeChannel(cid) {
    delete this.channels[cid];
  }

  setWait(wait, canvasId) {
    return setCoolDown(this.ipSub, this.id, canvasId, wait);
  }

  getWait(canvasId) {
    return getCoolDown(this.ipSub, this.id, canvasId);
  }

  /*
   * update lastSeen timestamp and userAgent
   */
  async touch() {
    if (!this.id || this.ip === '127.0.0.1') {
      return false;
    }
    return touchUserIP(this.id, this.ip, this.ua);
  }

  isAllowed(disableCache = false) {
    return isIPUserAllowed(this.ip, {
      disableCache,
      userId: this.id,
      userAgent: this.ua,
    });
  }

  async getUserData() {
    const {
      id,
      userlvl,
      channels,
      blocked,
    } = this;
    const data = {
      id,
      userlvl,
      channels,
      blocked,
    };
    if (!this.#regu) {
      return {
        ...data,
        name: null,
        blockDm: false,
        priv: false,
        mailreg: false,
      };
    }
    const [
      totalPixels,
      dailyTotalPixels,
      ranking,
      dailyRanking,
    ] = await getUserRanks(id);
    const regUser = this.#regu;
    return {
      ...data,
      name: regUser.name,
      blockDm: regUser.blockDm,
      priv: regUser.priv,
      totalPixels,
      dailyTotalPixels,
      ranking,
      dailyRanking,
      mailreg: !!(regUser.password),
    };
  }
}

export default User;
