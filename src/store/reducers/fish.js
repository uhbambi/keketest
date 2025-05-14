const initialState = {
  type: null,
  size: 0,
  // 5 to 30 depending on size
  screenSize: 1,
  // random position in percent
  screenPosX: 0,
  screenPosY: 0,
  screenRotation: 0,
};

export default function fish(state = initialState, action) {
  switch (action.type) {
    case 'FISH_APPEARS': {
      const { fishType: type, size } = action;
      // 5 - 30 depending on size
      const screenSize = 5 + size / 25 * 25;
      const screenPosX = Math.floor(Math.random() * (100 - screenSize));
      const screenPosY = Math.floor(Math.random() * (100 - screenSize));
      const screenRotation = Math.floor(Math.random() * 360);
      return {
        type,
        size,
        screenSize,
        screenPosX,
        screenPosY,
        screenRotation,
      };
    }

    case 'FISH_CATCHED':
    case 'FISH_VANISHES':
      return { ...initialState };

    default:
      return state;
  }
}
