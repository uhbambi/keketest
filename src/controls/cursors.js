/*
 * custom cursors that are defined in CSS properties that are named
 * '--cursor-[keyword]' with keyword according to
 * https://developer.mozilla.org/en-US/docs/Web/CSS/cursor
 */

/*
 * list of cursor availability, will be populated on requests
 */
const availableCursors = {};

/*
 * keywords that are available here but not in CSS standard
 */
const nonStandardCursors = [
  'pencil-color', 'pencil-history', 'pencil-template',
  'pencil-color-on', 'pencil-history-on', 'pencil-template-on',
  'move-color', 'move-history', 'move-template',
];

/*
 * set cursor for an element according to keyword
 */
export function setCursor(keyword, element, custom = true) {
  if (!element) {
    element = document.body;
  }
  const propertyName = `--cursor-${keyword}`;
  let cursorIsCustom;
  if (!custom) {
    cursorIsCustom = false;
  } else if (keyword in availableCursors) {
    cursorIsCustom = availableCursors[keyword];
  } else {
    cursorIsCustom = !!getComputedStyle(document.documentElement)
      .getPropertyValue(propertyName);
    availableCursors[keyword] = cursorIsCustom;
  }
  let cursorCss;
  if (cursorIsCustom) {
    cursorCss = `var(${propertyName})`;
  } else if (nonStandardCursors.includes(keyword)) {
    cursorCss = 'default';
  } else {
    cursorCss = keyword;
  }
  element.style.cursor = cursorCss;
}

export function getCursor(element) {
  if (!element) {
    element = document.body;
  }
  let { cursor } = element.style;
  if (!cursor) return 'default';
  let indexVar = cursor.indexOf('var(');
  if (indexVar !== -1) {
    indexVar += 4;
    cursor = cursor.substring(indexVar, cursor.indexOf(')', indexVar));
    if (cursor.startsWith('--cursor-')) {
      cursor = cursor.substring(9);
    } else {
      return 'default';
    }
  }
  return cursor;
}

export function resetCursor(element) {
  if (!element) {
    element = document.body;
  }
  element.style.cursor = 'auto';
}
