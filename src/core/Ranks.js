/*
 * timers and cron for account related actions
 */

import { populateIdObj } from '../data/sql/RegUser';
import {
  getRanks,
  resetDailyRanks,
  getPrevTop,
  getOnlineUserStats,
  storeOnlinUserAmount,
  getCountryDailyHistory,
  getCountryRanks,
  getTopDailyHistory,
  storeHourlyPixelsPlaced,
  getHourlyPixelStats,
  getDailyPixelStats,
} from '../data/redis/ranks';
import socketEvents from '../socket/socketEvents';
import logger from './logger';

import { MINUTE } from './constants';
import { DailyCron, HourlyCron } from '../utils/cron';

class Ranks {
  #ranks;

  constructor() {
    this.#ranks = {
      // ranking today of users by pixels
      dailyRanking: [],
      // ranking of users by pixels
      ranking: [],
      // ranking today of countries by pixels
      dailyCRanking: [],
      // yesterdays ranking of users by pixels
      prevTop: [],
      // online user amount by hour
      onlineStats: [],
      // ranking of countries by day
      cHistStats: [],
      // ranking of users by day
      histStats: { users: [], stats: [] },
      // pixels placed by hour
      pHourlyStats: [],
      // pixels placed by day
      pDailyStats: [],
    };
    /*
     * we go through socketEvents for sharding
     */
    socketEvents.on('rankingListUpdate', (rankings) => {
      this.#mergeIntoRanks(rankings);
    });
  }

  get ranks() {
    return this.#ranks;
  }

  async initialize() {
    try {
      this.#mergeIntoRanks(await Ranks.dailyUpdateRanking());
      this.#mergeIntoRanks(await Ranks.hourlyUpdateRanking());
      await Ranks.updateRanking();
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(`Error initialize ranks: ${err.message}`);
    }
    setInterval(Ranks.updateRanking, 5 * MINUTE);
    HourlyCron.hook(Ranks.setHourlyRanking);
    DailyCron.hook(Ranks.setDailyRanking);
  }

  #mergeIntoRanks(newRanks) {
    if (!newRanks) {
      return;
    }
    this.#ranks = {
      ...this.#ranks,
      ...newRanks,
    };
  }

  /*
   * populate ranking list with userdata inplace, censor private users
   * @param ranks Array of rank objects with userIds
   * @return ranks Array
   */
  static async #populateRanking(ranks) {
    const popRanks = await populateIdObj(ranks);
    // remove data of private users
    return popRanks.map((rank) => (rank.name ? rank : {}));
  }

  static async updateRanking() {
    // only main shard does it
    if (!socketEvents.important) {
      return null;
    }
    const ranking = await Ranks.#populateRanking(
      await getRanks(
        false,
        1,
        100,
      ));
    const dailyRanking = await Ranks.#populateRanking(
      await getRanks(
        true,
        1,
        100,
      ));
    const dailyCRanking = await getCountryRanks(1, 100);
    const ret = {
      ranking,
      dailyRanking,
      dailyCRanking,
    };
    socketEvents.rankingListUpdate(ret);
    return ret;
  }

  static async hourlyUpdateRanking() {
    const onlineStats = await getOnlineUserStats();
    const cHistStats = await getCountryDailyHistory();
    const pHourlyStats = await getHourlyPixelStats();
    const ret = {
      onlineStats,
      cHistStats,
      pHourlyStats,
    };
    if (socketEvents.important) {
      // only main shard sends to others
      socketEvents.rankingListUpdate(ret);
    }
    return ret;
  }

  static async dailyUpdateRanking() {
    const prevTop = await Ranks.#populateRanking(
      await getPrevTop(),
    );
    const pDailyStats = await getDailyPixelStats();
    const histStats = await getTopDailyHistory();
    const hisUsers = await Ranks.#populateRanking(histStats.users);
    histStats.users = hisUsers.filter((r) => r.name);
    histStats.stats = histStats.stats.map((day) => day.filter(
      (r) => histStats.users.some((u) => u.id === r.id),
    ));
    const ret = {
      prevTop,
      pDailyStats,
      histStats,
    };
    if (socketEvents.important) {
      // only main shard sends to others
      socketEvents.rankingListUpdate(ret);
    }
    return ret;
  }

  static async setHourlyRanking() {
    if (!socketEvents.important) {
      return;
    }
    const amount = socketEvents.onlineCounter.total;
    await storeOnlinUserAmount(amount);
    await storeHourlyPixelsPlaced();
    await Ranks.hourlyUpdateRanking();
  }

  /*
   * reset daily rankings, store previous rankings
   */
  static async setDailyRanking() {
    if (!socketEvents.important) {
      return;
    }
    logger.info('Resetting Daily Ranking');
    await resetDailyRanks();
    await Ranks.dailyUpdateRanking();
  }
}


export default new Ranks();
