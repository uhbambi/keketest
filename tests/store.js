import { patchState } from '../src/store/index.js';


const state = {
  channels: {
    1: [[1, 2, 3, 4]],
  },
  haha: 'lol',
}

const patch = {
  op: 'addnx',
  path: 'channels.3[0:1]',
  value: [5, 6, 7, 8],
}

console.log(JSON.stringify(state), '\n', patch, '\n', JSON.stringify(patchState(state, patch)));
