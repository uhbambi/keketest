/*
 * keeps track of some api fetching states
 *
 */

const initialState = {
  fetchingChunks: 0,
  fetchingPixel: false,
};

export default function fetching(
  state = initialState,
  action,
) {
  switch (action.type) {
    case 'REQ_BIG_CHUNK': {
      const {
        fetchingChunks,
      } = state;

      return {
        ...state,
        fetchingChunks: fetchingChunks + 1,
      };
    }

    case 'REC_BIG_CHUNK':
    case 'REC_BIG_CHUNK_FAILURE': {
      const { fetchingChunks } = state;

      return {
        ...state,
        fetchingChunks: fetchingChunks - 1,
      };
    }

    case 'SET_PXLS_FETCHING': {
      const { fetching: fetchingPixel } = action;
      return {
        ...state,
        fetchingPixel,
      };
    }

    default:
      return state;
  }
}
