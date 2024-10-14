/*
 * redux store
 */

import {
  /*
   * redux wants us to use the redux-toolkit really hard,
   * we do not want that, it abstracts too much away,
   * if there should ever arise a necessity to use the redux toolkit,
   * we shall switch to a different librry or make our own
   */
  applyMiddleware, combineReducers, legacy_createStore as createStore,
} from 'redux';
import { thunk } from 'redux-thunk';
import { persistReducer } from 'redux-persist';
import storage from 'redux-persist/lib/storage';

import sharedReducers, {
  migrate,
} from './sharedReducers';

/*
 * reducers
 */
import windows from './reducers/windows';
import alert from './reducers/alert';

/*
 * middleware
 */
import audio from './middleware/audio';
import socketClientHook from './middleware/socketClientHook';
import rendererHook from './middleware/rendererHook';
import array from './middleware/array';
import notifications from './middleware/notifications';
import title from './middleware/title';
import popUps from './middleware/popUps';
import extensions from './middleware/extensions';

const windowsPersist = persistReducer({
  key: 'wind',
  storage,
  version: 17,
  migrate,
}, windows);

const reducers = combineReducers({
  ...sharedReducers,
  windows: windowsPersist,
  alert,
});

const store = createStore(
  reducers,
  applyMiddleware(
    thunk,
    array,
    popUps,
    audio,
    notifications,
    title,
    socketClientHook,
    extensions,
    rendererHook,
  ),
);

/*
 * persistStore of redux-persist is called in client.js
 */

export default store;
