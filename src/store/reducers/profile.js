import patchState from '../index.js';

const initialState = {
  fishes: [],
  badges: [],
  /*
   * [{
   *     fid,
   *     name,
   *     title,
   *     description,
   *     isPrivate,
   *     isPublic,
   *     isHidden,
   *     avatarId,
   *     roles: [{
   *       frid,
   *       name,
   *       customFlagId,
   *       factionlvl,
   *       isMember,
   *     }, ...],
   *   }, ...],
   */
  factions: [],
  activeFactionRole: null,
  /*
   * 0: not fetched
   * 1: requested
   * 2: fetched
   */
  fetched: false,
};

export default function profile(state = initialState, action) {
  switch (action.type) {
    case 's/REC_PROFILE':
      return {
        ...state,
        ...action.profile,
        fetched: true,
      };

    case 's/PATCH_STATE': {
      if (action.state === 'profile') {
        return patchState(state, action.patch)[0];
      }
      return state;
    }

    case 's/LOGIN':
    case 's/LOGOUT':
      // reset profile if user changes
      return { ...initialState };

    default:
      return state;
  }
}
