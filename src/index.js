/* global __DEV__ */


const willThrowErrorIfNotSet = label => () => {
  throw new Error(`parameterizedSelector: ${label} must be set.`);
};

const defaultOptions = {
  // Some options can only be set at initialization
  displayNamePrefix: 'parameterizedSelector',
  createKeyFromParams: willThrowErrorIfNotSet('createKeyFromParams'),
  compareIncomingStates: willThrowErrorIfNotSet('compareIncomingStates'),
  compareSelectorResults: willThrowErrorIfNotSet('compareSelectorResults'),
  isRootSelector: willThrowErrorIfNotSet('isRootSelector'),
  // Some options can be changed anytime
  displayName: null,
  verboseLoggingEnabled: true,
  verboseLoggingCallback: console.log,
  performanceChecksEnabled: (typeof __DEV__ !== 'undefined' && !!__DEV__),
  performanceChecksCallback: console.log,
  warningsEnabled: true,
  warningsCallback: console.warn,
};

// When a parameterizedSelector is called, we'll note what other parameterizedSelectors it calls here,
// so that we know which dependencies to dirty-check the next time it runs.
const parameterizedSelectorCallStack = [];

let unnamedCount = 0;


//
// Presets
//
// These are inspired heavily by https://github.com/moroshko/shallow-equal and https://github.com/tkh44/shallow-compare

/**
 * This is used only to short-circuit more expensive equality checks.
 */
const cannotPossiblyBeEqual = (a, b) => {
  if (a) {
    if (!b || a.length !== b.length || typeof a !== typeof b ||
      (a instanceof Object && Object.keys(a).length !== Object.keys(b).length)
    ) {
      // If they aren't the same general thing and shape, don't match
      return true;
    }
  } else if (b) {
    return true;
  }
  return false;
};

const COMPARISON_PRESETS = {
  SAME_REFERENCE: (a, b) =>
    a === b,
  SHALLOW_EQUAL: (a, b) => {
    if (a === b) {
      return true;
    }
    if (cannotPossiblyBeEqual(a, b)) {
      return false;
    }
    for (let i in a) {
      if (!(i in b)) {
        return false;
      }
    }
    for (let i in b) {
      if (a[i] !== b[i]) {
        return false;
      }
    }
    return true;
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
  RUN_EVERY_TIME: () =>
    false,
  RUN_ONLY_ONCE: () =>
    true,
};

const KEY_PRESETS = {
  JSON_STRING: JSON.stringify,
  JSON_STRING_WITH_UNSTABLE_KEYS: (obj) => {
    if (obj) {
      const newObject = {};
      const sortedKeys = Object.keys(obj).sort();
      for (let i = 0; i < sortedKeys.length; i += 1) {
        const key = sortedKeys[i];
        newObject[key] = obj[key];
      }
      return JSON.stringify(newObject);
    }
    return JSON.stringify(obj);
  },
};


//
// Exported functions
//

/**
 *
 * @param {Function} transformFn required
 * @param {Object} overrideOptions optional
 */
const parameterizedSelectorFactory = (transformFn, overrideOptions = {}) => {
  const options = {
    ...defaultOptions,
    ...overrideOptions,
  };

  if (!options.displayName) {
    const functionDisplayName = transformFn.displayName || transformFn.name;
    if (functionDisplayName) {
      options.displayName = `${options.displayNamePrefix}(${functionDisplayName})`;
    } else {
      unnamedCount += 1;
      options.displayName = `${options.displayNamePrefix}(#${unnamedCount})`;
    }
  }
  if (options.verboseLoggingEnabled) {
    options.verboseLoggingCallback(`Creating parameterized selector: "${options.displayName}"`);
  }

  // These options cannot be changed later
  const {
    createKeyFromParams,
    compareIncomingStates,
    compareSelectorResults,
    isRootSelector,
  } = options;

  // This is where we'll maintain a stash of prior inputs and results.
  const previousResultsByParam = {};
  // When a selector is dirty-checked we want to mark it so that it won't get
  // re-checked again during the same cycle.
  let invokationId = 0;

  /*
   * This is the real selector function. Whenever it gets run, there are three
   * possible outcomes:
   *  A) Nothing has changed about its inputs -- either it's already been run during this
   *      cycle, or the state hasn't changed meaningfully since the last time it ran.
   *  B) Its dependencies don't return any meaningfully different values. This means
   *      that *they* may re-run, but this function won't.
   *  C) If either its inputs or its dependencies' outputs have changed, or if it hasn't
   *      been run before, then it'll run. As part of this it'll record itself as
   *      a dependency for whatever function called it.
   */
  const parameterizedSelector = (...args) => {
    let isFirstSelectorInCallStack = !parameterizedSelectorCallStack.length;
    let state;
    let keyParams;
    let additionalArgs;
    let recordDependencies = false;
    if (isFirstSelectorInCallStack) {
      // When called from outside (i.e., from mapStateToProps) the state will to be provided.
      [state, keyParams, ...additionalArgs] = args;
      invokationId += 1;
    } else {
      // When called from within another parameterizedSelector, state will be added internally
      // and we'll have some local info as the first argument.
      ({ state, recordDependencies } = parameterizedSelectorCallStack[parameterizedSelectorCallStack.length - 1]);
      [keyParams, ...additionalArgs] = args;
    }

    // Do we have a prior result for this parameterizedSelector + its keyParams?
    const keyParamsString = createKeyFromParams(keyParams);

    const verboseLoggingPrefix = options.verboseLoggingEnabled &&
      `Parameterized selector "${options.displayName}(${keyParamsString})"`;

    const previousResult = previousResultsByParam[keyParamsString];
    let canUsePreviousResult = false;
    if (previousResult) {
      if (invokationId === previousResult.invokationId) {
        // It's already run in this very cycle: don't even bother comparing state
        canUsePreviousResult = true;
      } else if (compareIncomingStates(state, previousResult.state)) {
        // No state change means no result change
        canUsePreviousResult = true;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${verboseLoggingPrefix} won't re-run because state didn't change`);
        }
      }

      // If canUsePreviousResult is true at this point then we've matched scenario A above

      if (!canUsePreviousResult) {
        if (previousResult.dependencies.length > 0) {
          // We need to check the prior dependencies to see if they've actually changed.
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${verboseLoggingPrefix} is testing its dependencies...`);
          }

          let anyDependencyHasChanged = false; // until proven guilty
          for (let i = 0; i < previousResult.dependencies.length; i += 1) {
            const [previousSelector, previousKeyParams, previousReturnValue] = previousResult.dependencies[i];

            let newReturnValue;
            if (isFirstSelectorInCallStack) {
              // If nobody else is tracking dependencies, we don't want to start now.
              newReturnValue = previousSelector(state, previousKeyParams, ...additionalArgs);
            } else {
              // Since we're only checking dependencies, we don't want child selectors
              // to change anything: this will give them a 'recordDependencies: false'
              parameterizedSelectorCallStack.push(previousResult);
              newReturnValue = previousSelector(previousKeyParams, ...additionalArgs);
              parameterizedSelectorCallStack.pop();
            }

            if (!compareSelectorResults(newReturnValue, previousReturnValue)) {
              anyDependencyHasChanged = true;
              if (options.verboseLoggingEnabled) {
                const previousKeyParamString = createKeyFromParams(previousKeyParams);
                options.verboseLoggingCallback(`${verboseLoggingPrefix} will re-run because "${previousSelector.displayName}(${previousKeyParamString})" returned a new value.`);
              }
              break;
            }
          }
          if (!anyDependencyHasChanged) {
            if (options.verboseLoggingEnabled) {
              options.verboseLoggingCallback(`${verboseLoggingPrefix} won't re-run because no dependencies changed`);
            }
            canUsePreviousResult = true;
          }

        }
      }
    } else if (options.verboseLoggingEnabled) {
      options.verboseLoggingCallback(`${verboseLoggingPrefix} is running for the first time`);
    }

    // If canUsePreviousResult is true at this point then we've matched scenario A or B above,
    // else we need to re-run (scenario C)

    let returnValue;
    if (canUsePreviousResult) {
      previousResult.invokationId = invokationId;
      returnValue = previousResult.returnValue;
    } else {
      // Since we're re-running, any dependencies that get called need to be registered.
      const newResult = {
        invokationId,
        state,
        recordDependencies: true,
        dependencies: [],
        returnValue: null,
      };
      parameterizedSelectorCallStack.push(newResult);

      if (isRootSelector) {
        returnValue = transformFn(state, keyParams, ...additionalArgs);
      } else {
        returnValue = transformFn(keyParams, ...additionalArgs);
      }
      parameterizedSelectorCallStack.pop();
      newResult.recordDependencies = false;

      if (previousResult && compareSelectorResults(returnValue, previousResult.returnValue)) {
        // We got back the same result: return what we had before and update the record
        returnValue = previousResult.returnValue;
        previousResult.invokationId = invokationId;
        newResult.returnValue = returnValue;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${verboseLoggingPrefix} didn't need to re-run: the result is the same`, previousResult);
        }
      } else {
        // It really IS new!
        newResult.returnValue = returnValue;
        previousResultsByParam[keyParamsString] = newResult;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${verboseLoggingPrefix} has a new result: `, newResult);
        }
      }
    }

    // We need to add an entry to let the parent/calling parameterizedSelector know that this one was
    // called, regardless of whether or not we used a cached value.
    if (recordDependencies && !isFirstSelectorInCallStack) {
      const parentCaller = parameterizedSelectorCallStack[parameterizedSelectorCallStack.length - 1];
      parentCaller.dependencies.push([parameterizedSelector, keyParams, returnValue]);
    }

    return returnValue;
  };

  parameterizedSelector.isParameterizedSelector = true;
  parameterizedSelector.displayName = options.displayName;
  parameterizedSelector.isRootSelector = isRootSelector;

  return parameterizedSelector;
};

parameterizedSelectorFactory.withOptions = (localOptions) =>
  (transformFn, options = {}) => parameterizedSelectorFactory(transformFn, {
    ...localOptions,
    ...options,
  });


const createParameterizedRootSelector = parameterizedSelectorFactory.withOptions({
  createKeyFromParams: KEY_PRESETS.JSON_STRING,
  compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
  compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE,
  isRootSelector: true,
});

const createParameterizedSelector = parameterizedSelectorFactory.withOptions({
  createKeyFromParams: KEY_PRESETS.JSON_STRING,
  compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
  compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE,
  isRootSelector: false,
});


export {
  KEY_PRESETS,
  COMPARISON_PRESETS,
  parameterizedSelectorFactory,
  createParameterizedRootSelector,
  createParameterizedSelector,
};
