/*
 * map flags of user
 */
import { USERLVL } from '../core/constants.js';

export default function mapFlag(userlvl, country) {
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
  return country;
}
