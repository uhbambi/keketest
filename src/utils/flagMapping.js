/*
 * map flags of user
 */
import { USERLVL } from '../core/constants.js';
import { getCustomFlagById } from '../data/sql/CustomFlag.js';

export default async function mapFlag(uid, userlvl, country) {
  if (userlvl >= USERLVL.CLEANER) {
    switch (userlvl) {
      case USERLVL.CLEANER:
        return 'z3';
      case USERLVL.JANNY:
        return 'z2';
      case USERLVL.MOD:
        return 'z1';
      default:
        return 'zz';
    }
  }
  const hasCustomFlag = await getCustomFlagById(uid);
  if (hasCustomFlag) return hasCustomFlag;
  return country;
}
