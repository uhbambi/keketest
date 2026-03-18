import { useEffect } from 'react';
import { useSelector, useDispatch, shallowEqual } from 'react-redux';

import { fetchProfile } from '../../store/actions/thunks.js';

function useProfile(selector) {
  const [fetched, value] = useSelector((state) => [
    state.profile.fetched,
    selector(state.profile),
  ], shallowEqual);
  const dispatch = useDispatch();

  useEffect(() => {
    if (!fetched) {
      dispatch(fetchProfile());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetched]);

  return value;
}

export default useProfile;
