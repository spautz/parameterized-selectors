/* global __DEV__ */

import isEmpty from 'lodash/isEmpty';

//
// Internal setup and bookkeeping
//

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
  hasDynamicDependencies: true,
  // Some options can be changed anytime
  displayName: null,
  useConsoleGroup: true,
  verboseLoggingEnabled: false,
  verboseLoggingCallback: console.log, /* eslint-disable-line no-console */
  performanceChecksEnabled: (typeof __DEV__ !== 'undefined' && !!__DEV__),
  performanceChecksCallback: console.log, /* eslint-disable-line no-console */
  warningsEnabled: true,
  warningsCallback: console.warn, /* eslint-disable-line no-console */
};

/**
 * When a parameterizedSelector is run, we'll add it to this stack so that *other* parameterizedSelectors
 * can register themselves as dependencies for it. This let us know which dependencies to dirty-check
 * the next time it runs.
 */
const parameterizedSelectorCallStack = [];

/**
 * Each selector needs a unique displayName. We'll pull that from options or the innerFn if possible,
 * but if we have to fall back to raw numbers we'll use this counter to keep them distinct.
 */
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

const KEY_PRESETS = {
  JSON_STRING: JSON.stringify,
  JSON_STRING_WITH_UNSTABLE_KEYS: (obj) => {
    if (obj && typeof obj === 'object') {
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
 * This is where ALL parameterized selectors come from: both 'root' and non-root ones.
 *
 * @param {Function} innerFn required
 * @param {Object} overrideOptions optional
 */
const parameterizedSelectorFactory = (innerFn, overrideOptions = {}) => {
  const options = {
    ...defaultOptions,
    ...overrideOptions,
  };

  if (!options.displayName) {
    const functionDisplayName = innerFn.displayName || innerFn.name;
    if (functionDisplayName) {
      options.displayName = `${options.displayNamePrefix}(${functionDisplayName})`;
    } else {
      unnamedCount += 1;
      options.displayName = `${options.displayNamePrefix}(#${unnamedCount})`;
    }
  }
  if (options.verboseLoggingEnabled) {
    options.verboseLoggingCallback(`Creating parameterized selector: "${options.displayName}"`, options);
  }

  // These options cannot be changed later
  const {
    createKeyFromParams,
    compareIncomingStates,
    compareSelectorResults,
    isRootSelector,
  } = options;

  /**
   * This is where we'll maintain a stash of prior inputs and results.
   * Format: {
   *    [keyParamsString]: resultRecord
   *  }
   */
  const previousResultsByParam = {};

  /**
   * When a selector is dirty-checked we want to mark it so that it won't get re-checked again during
   * the same cycle. This effectively acts like a counter of the distinct states we've seen.
   */
  let invokationId = 0;
  let stateForLastInvokation = null;


  /**
   * This performs some standard argument-massaging and inspects the previous result (if any) to determine
   * whether it's still valid. This is used by both the parameterizedSelector and its .hasCachedResult()
   *
   * There are two scenarios where the previous result will still be valid:
   *  A) Nothing has changed this our inputs since the last time we checked. (Either we've already run
   *      once during this cycle/invokation, or the state hasn't changed since the last time we ran.)
   *  B) All of our dependencies have cached results. Note that this means the dependencies *may* re-run
   *      just to check this one.
   *
   * @return {Boolean}
   */
  const getPreviousResultInfo = (args) => {
    const parentCaller = parameterizedSelectorCallStack[parameterizedSelectorCallStack.length - 1] || null;
    let state;
    let keyParams;
    let additionalArgs;
    if (parentCaller) {
      // When called from within another parameterizedSelector, state will be added internally
      // and we'll have some local info as the first argument.
      ({ state } = parentCaller);
      [keyParams, ...additionalArgs] = args;
    } else {
      // When called from outside (i.e., from mapStateToProps) the state will to be provided.
      [state, keyParams, ...additionalArgs] = args;
      if (
        invokationId === 0
        || !state
        || !stateForLastInvokation
        || !compareIncomingStates(stateForLastInvokation, state)
      ) {
        // New state!
        invokationId += 1;
        stateForLastInvokation = state;
      }
    }

    // Do we have a prior result for this parameterizedSelector + its keyParams?
    const keyParamsString = createKeyFromParams(keyParams);
    const verboseLoggingPrefix = options.verboseLoggingEnabled
      && `Parameterized selector "${options.displayName}(${keyParamsString})"`;

    const previousResult = previousResultsByParam[keyParamsString];
    let canUsePreviousResult = false; // until proven otherwise

    if (previousResult) {
      if (invokationId === previousResult.invokationId) {
        // It's already run in this very cycle: don't even bother comparing state
        canUsePreviousResult = true;
      } else if (state && previousResult.state && compareIncomingStates(previousResult.state, state)) {
        // Even if the invokation thinks it's a new state, if it's not actually new then we can reuse
        // what we had before.
        canUsePreviousResult = true;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${verboseLoggingPrefix} won't re-run because state didn't change`);
        }
      }

      // If canUsePreviousResult is true at this point then we've matched scenario A above

      if (!canUsePreviousResult && previousResult.dependencies.length > 0) {
        // We need to check the prior dependencies to see if they've actually changed.
        if (options.verboseLoggingEnabled && options.useConsoleGroup) {
          console.group(`${verboseLoggingPrefix} is testing its dependencies...`);
        }

        let anyDependencyHasChanged = false; // until proven guilty
        for (let i = 0; i < previousResult.dependencies.length; i += 1) {
          const [previousSelector, previousKeyParams, previousReturnValue] = previousResult.dependencies[i];

          let newReturnValue;
          if (parentCaller) {
            // Since we're only checking dependencies, we don't want child selectors to change anything.
            // This will give them a 'parentCaller.recordDependencies: false'
            parameterizedSelectorCallStack.push(previousResult);
            newReturnValue = previousSelector(previousKeyParams, ...additionalArgs);
            parameterizedSelectorCallStack.pop();
          } else {
            // If nobody else is tracking dependencies, we don't want to start now.
            newReturnValue = previousSelector(state, previousKeyParams, ...additionalArgs);
          }

          if (!compareSelectorResults(previousReturnValue, newReturnValue)) {
            anyDependencyHasChanged = true;
            if (options.verboseLoggingEnabled) {
              const previousKeyParamString = createKeyFromParams(previousKeyParams);
              options.verboseLoggingCallback(`${verboseLoggingPrefix} will re-run because "${previousSelector.displayName}(${previousKeyParamString})" returned a new value.`);
            }
            break;
          }
        }
        if (!anyDependencyHasChanged) {
          // Scenario B
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${verboseLoggingPrefix} won't re-run because no dependencies changed`);
          }
          canUsePreviousResult = true;
        }

        if (options.verboseLoggingEnabled && options.useConsoleGroup) {
          console.groupEnd();
        }
      }
    }

    return {
      parentCaller,
      state,
      keyParams,
      keyParamsString,
      additionalArgs,
      verboseLoggingPrefix,
      previousResult,
      canUsePreviousResult,
    };
  };

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
    const {
      parentCaller,
      state,
      keyParams,
      keyParamsString,
      additionalArgs,
      verboseLoggingPrefix,
      previousResult,
      canUsePreviousResult,
    } = getPreviousResultInfo(args);

    if (options.verboseLoggingEnabled && !previousResult) {
      options.verboseLoggingCallback(`${verboseLoggingPrefix} is running for the first time`);
    }

    // If canUsePreviousResult is true at this point then we've matched scenario A or B above,
    // else we need to re-run (scenario C)

    let returnValue;
    if (canUsePreviousResult) {
      previousResult.invokationId = invokationId;
      ({ returnValue } = previousResult);
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
        returnValue = innerFn(state, keyParams, ...additionalArgs);
      } else {
        returnValue = innerFn(keyParams, ...additionalArgs);
      }
      parameterizedSelectorCallStack.pop();
      newResult.recordDependencies = false;

      if (previousResult && compareSelectorResults(previousResult.returnValue, returnValue)) {
        // We got back the same result: return what we had before and update the record
        ({ returnValue } = previousResult);
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
    if (parentCaller && parentCaller.recordDependencies) {
      parentCaller.dependencies.push([parameterizedSelector, keyParams, returnValue]);
    }

    return returnValue;
  };

  /**
   * This offers a way to inspect a parameterizedSelector call's status without calling it.
   * Note that *dependencies* may be called, however, to determine whether their values are still valid.
   *
   * @TODO: Maybe add a flag to distinguish 'cheap' dependencies from expensive ones, and use that to
   *        decide when/whether to re-run the dependencies to see if they've changed.
   */
  parameterizedSelector.hasCachedResult = (...args) => {
    const {
      canUsePreviousResult,
    } = getPreviousResultInfo(args);

    return canUsePreviousResult;
  };

  parameterizedSelector.isParameterizedSelector = true;
  parameterizedSelector.displayName = options.displayName;
  parameterizedSelector.isRootSelector = isRootSelector;

  return parameterizedSelector;
};

parameterizedSelectorFactory.withOptions = localOptions => // eslint-disable-next-line implicit-arrow-linebreak
  (innerFn, options = {}) => parameterizedSelectorFactory(innerFn, {
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
