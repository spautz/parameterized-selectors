/* global __DEV__ */

const defaultOptions = {
  displayName: null,
  displayNamePrefix: 'parameterizedSelector',
  verboseLoggingEnabled: true,
  verboseLoggingCallback: console.log,
  performanceChecksEnabled: (typeof __DEV__ !== 'undefined' && __DEV__),
  performanceChecksCallback: console.log,
  warningsEnabled: true,
  warningsCallback: console.warn,
};

// When a parameterizedSelector is called, we'll note what other parameterizedSelectors it calls here,
// so that we know which dependencies to dirty-check the next time it runs.
const parameterizedSelectorCallStack = [];

let unnamedCount = 0;


const willThrowErrorIfNotSet = label => () => {
  throw new Error(`parameterizedSelector: ${label} must be set.`);
};

//
// Presets
//
// These are inspired heavily by https://github.com/moroshko/shallow-equal and https://github.com/tkh44/shallow-compare

const maybeEquivalent = (a, b) => {
  if (a === b) {
    return true;
  }
  if (!!a !== !!b) {
    return false;
  }
  if (a) {
    if (a.length !== b.length) {
      return false;
    }
    if (Object.keys(a).length !== Object.keys(b).length) {
      return false;
    }
  }
  return null;
};

const COMPARISON_PRESETS = {
  SAME_REFERENCE: (a, b) =>
    a === b,
  SHALLOW_EQUAL: (a, b) => {
    const equivalence = maybeEquivalent(a, b);
    if (equivalence != null) {
      return equivalence;
    }
    for (let i in a) {
      if (!(i in b)) {
        return true;
      }
    }
    for (let i in b) {
      if (a[i] !== b[i]) {
        return true;
      }
    }
    return false;
  },
  JSON_STRING: (a, b) => {
    const equivalence = maybeEquivalent(a, b);
    if (equivalence != null) {
      return equivalence;
    }
    return JSON.stringify(a) === JSON.stringify(b);
  },
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
 * Returns the options that will be used for newly-created parameterizedSelectors
 *
 * @return {Object}
 */
const getDefaultOptions = () => defaultOptions;

/**
 * Updates the options that will be used for newly-created parameterizedSelectors
 *
 * @param {Object} newOptions
 * @return {Object}
 */
const setDefaultOptions = (newOptions = {}) => Object.assign(defaultOptions, newOptions);


/**
 *
 * @param {Function} transformFn required
 * @param {Object} options optional
 */
const parameterizedSelectorFactoryFactory = ({
  createKeyFromParams = willThrowErrorIfNotSet('createKeyFromParams'),
  incomingStateComparison = willThrowErrorIfNotSet('incomingStateComparison'),
  previousResultComparison = willThrowErrorIfNotSet('previousResultComparison'),
  isRootSelector = willThrowErrorIfNotSet('isRootSelector'),
  treatNonRootSelectorsAsDependencies = willThrowErrorIfNotSet('treatNonRootSelectorsAsDependencies'),
}) => (transformFn, localOptions) => {
  const options = {
    ...defaultOptions,
    ...localOptions,
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

  // This is where we'll maintain a stash of prior inputs and results.
  const previousResultsByParam = {};

  /*
   * This is the real selector
   */
  const parameterizedSelector = (...args) => {
    let state;
    let keyParams;
    let additionalArgs;
    if (parameterizedSelectorCallStack.length) {
      // This was called from within another parameterizedSelector, so we don't have a `state` argument:
      // shift the args
      state = parameterizedSelectorCallStack[0].state;
      [keyParams, ...additionalArgs] = args;
    } else {
      // When called from outside (i.e., from mapStateToProps) the state needs to be provided.
      [state, keyParams, ...additionalArgs] = args;
    }

    // Do we have a prior result for this parameterizedSelector + its keyParams?
    const keyParamsString = createKeyFromParams(keyParams);
    const previousResult = previousResultsByParam[keyParamsString];

    let canUsePreviousResult = false;
    if (previousResult) {
      if (incomingStateComparison(state, previousResult.state)) {
        // No state change means no change
        canUsePreviousResult = true;
      }
      if (previousResult.dependencies.length > 0) {
        let anyDependencyHasChanged = false; // until proven guilty
        for (let i = 0; i < previousResult.dependencies.length; i += 1) {
          const [previousSelector, previousKeyParams, previousReturnValue] = previousResult.dependencies[i];
          const newReturnValue = previousSelector(state, previousKeyParams, ...additionalArgs);
          if (newReturnValue !== previousReturnValue) {
            anyDependencyHasChanged = true;
            break;
          }
        }
        if (!anyDependencyHasChanged) {
          canUsePreviousResult = true;
        }
      }
    }

    let returnValue;
    if (canUsePreviousResult) {
      if (options.verboseLoggingEnabled) {
        options.verboseLoggingCallback(`Parameterized selector "${options.displayName}(${keyParamsString})" is already cached`);
      }
      returnValue = previousResult.returnValue;
    } else {
      // Darn: we need to re-run.
      // Now any subsequent parameterizedSelectors will see us as the parent/caller.
      if (options.verboseLoggingEnabled) {
        options.verboseLoggingCallback(`Parameterized selector "${options.displayName}(${keyParamsString})" needs to re-run`);
      }
      const newResult = {
        state,
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

      if (previousResult && previousResultComparison(returnValue, previousResult.returnValue)) {
        // We got back the same result: just update the existing record
        previousResult.state = state;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`Parameterized selector "${options.displayName}(${keyParamsString})" didn't need to re-run: the result is the same`, previousResult);
        }
      } else {
        // It really IS new!
        newResult.returnValue = returnValue;
        previousResultsByParam[keyParamsString] = newResult;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`Parameterized selector "${options.displayName}(${keyParamsString})" has a new result: `, newResult);
        }
      }
    }

    // We need to add an entry to let the parent/calling parameterizedSelector know that this one was
    // called.
    if (parameterizedSelectorCallStack.length) {
      // Let all the callers know that this is a dependency to pay attention to
      for (let i = 0; i < parameterizedSelectorCallStack.length; i += 1) {
        const selectorThatDependsOnThis = parameterizedSelectorCallStack[i];
        if (isRootSelector || selectorThatDependsOnThis.treatNonRootSelectorsAsDependencies) {
          selectorThatDependsOnThis.dependencies.push([parameterizedSelector, keyParams, returnValue]);
        }
      }
    }

    return returnValue;
  };

  parameterizedSelector.isParameterizedSelector = true;
  parameterizedSelector.displayName = options.displayName;
  parameterizedSelector.isRootSelector = isRootSelector;
  parameterizedSelector.treatNonRootSelectorsAsDependencies = treatNonRootSelectorsAsDependencies;

  return parameterizedSelector;
};


const createParameterizedRootSelector = parameterizedSelectorFactoryFactory({
  createKeyFromParams: KEY_PRESETS.JSON_STRING,
  incomingStateComparison: COMPARISON_PRESETS.SAME_REFERENCE,
  previousResultComparison: COMPARISON_PRESETS.SHALLOW_EQUAL,
  isRootSelector: true,
});

const createParameterizedSelector = parameterizedSelectorFactoryFactory({
  createKeyFromParams: KEY_PRESETS.JSON_STRING,
  incomingStateComparison: COMPARISON_PRESETS.SAME_REFERENCE,
  previousResultComparison: COMPARISON_PRESETS.SAME_REFERENCE,
  isRootSelector: false,
  treatNonRootSelectorsAsDependencies: true,
});

export {
  COMPARISON_PRESETS,
  getDefaultOptions,
  setDefaultOptions,
  parameterizedSelectorFactoryFactory,
  createParameterizedRootSelector,
  createParameterizedSelector,
};
