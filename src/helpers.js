import isEmpty from 'lodash/isEmpty';
import isPlainObject from 'lodash/isPlainObject';


/**
 * This is used only to short-circuit more expensive equality checks.
 */
const cannotPossiblyBeEqual = (a, b) => {
  if (a) {
    if (!b || a.length !== b.length || typeof a !== typeof b
      || (a instanceof Object && Object.keys(a).length !== Object.keys(b).length)
    ) {
      // If they aren't the same general thing and shape, don't match
      return true;
    }
  } else if (b) {
    return true;
  }
  return null;
};


/**
 * Comparison functions can be used to determine whether the current output and previous output of a selector
 * should be treated as though they're the same function, and (for root selectors) whether a 'new' state
 * should be treated as though it's the previous state.
 *
 * These are inspired heavily by https://github.com/moroshko/shallow-equal and https://github.com/tkh44/shallow-compare
 */
const COMPARISON_PRESETS = {
  SAME_REFERENCE: (a, b) => a === b,
  SAME_REFERENCE_OR_EMPTY: (a, b) => a === b || (isEmpty(a) && isEmpty(b)),
  SHALLOW_EQUAL: (a, b) => {
    if (a === b) {
      return true;
    }
    if (cannotPossiblyBeEqual(a, b)) {
      return false;
    }
    if (a instanceof Object) {
      for (const i in a) { // eslint-disable-line no-restricted-syntax
        if (!(i in b)) {
          return false;
        }
      }
      for (const i in b) { // eslint-disable-line no-restricted-syntax
        if (a[i] !== b[i]) {
          return false;
        }
      }
      return true;
    }
    // else they're not objects: the earlier checks should have been enough
    return false;
  },
  JSON_STRING: (a, b) => {
    if (a === b) {
      return true;
    }
    if (cannotPossiblyBeEqual(a, b)) {
      return false;
    }
    return JSON.stringify(a) === JSON.stringify(b);
  },
  RUN_EVERY_TIME: () => false,
  RUN_ONLY_ONCE: () => true,
};


/**
 * @TODO: Set up a named-parameter alternative to stringified keys
 */
const KEY_PRESETS = {
  JSON_STRING: (obj) => {
    if (obj && typeof obj === 'object') {
      return JSON.stringify(obj);
    }
    return String(obj);
  },
  JSON_STRING_WITH_STABLE_KEYS: (obj) => {
    if (obj && isPlainObject(obj)) {
      const newObject = {};
      const sortedKeys = Object.keys(obj).sort();
      for (let i = 0; i < sortedKeys.length; i += 1) {
        const key = sortedKeys[i];
        newObject[key] = obj[key];
      }
      return JSON.stringify(newObject);
    }
    return KEY_PRESETS.JSON_STRING(obj);
  },
};


export {
  COMPARISON_PRESETS,
  KEY_PRESETS,
};
