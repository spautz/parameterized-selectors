import { defaultOptions } from './defaultOptions';


/**
 * When any parameterizedSelector is run, we'll add it to this stack so that *other* parameterizedSelectors
 * can register themselves as dependencies for it. This let us know which dependencies to dirty-check
 * the next time it runs.
 *
 * This single instance is used forever across all selectors.
 */
const parameterizedSelectorCallStack = [];

/**
 * Each selector needs a unique displayName. We'll pull that from options or the innerFn if possible,
 * but if we have to fall back to raw numbers we'll use this counter to keep them distinct.
 */
let unnamedCount = 0;


/**
 * This is where ALL parameterized selectors are created, both 'root' and non-root ones.
 * The basic idea is to set up the local context for the selector, do some sanity-checks if appropriate,
 * and return the 'outer' selector function with a few helpers attached.
 *
 * @param {Function} innerFn required
 * @param {Object} overrideOptions optional
 */
const parameterizedSelectorFactory = (innerFn, overrideOptions = {}) => {
  const options = {
    ...defaultOptions,
    ...overrideOptions,
  };
  // @TODO: Warn if given any unrecognized or deprecated options

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
    hasStaticDependencies,
  } = options;

  /**
   * This is where we'll maintain a stash of prior inputs and results.
   * Format: {
   *    [keyParamsString]: resultRecord,
   *  }
   *
   *  where each resultRecord looks like: {
   *    state,
   *    dependencies: [
   *      [parameterizedSelector, keyParams, returnValue],
   *      ...
   *    ],
   *    returnValue,
   *    callCount,
   *    recomputationCount,
   *  }
   */
  const previousResultsByParam = {};

  /**
   * Here we can track the number of recomputations due to cache misses, state changes, param changes etc,
   * and the number of times the selector was ever called (regardless of whether it recomputed.)
   * This is primarily used for performance and unit-testing purposes.
   *
   * Note that these counts apply across ALL params for the selector. There is a separate set of per-param
   * counters, tracked in the previousResults.
   */
  let totalCallCount = 0;
  let totalRecomputationCount = 0;


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
    }

    // Do we have a prior result for this parameterizedSelector + its keyParams?
    const keyParamsString = createKeyFromParams(keyParams);
    const verboseLoggingPrefix = options.verboseLoggingEnabled
      && `Parameterized selector "${options.displayName}(${keyParamsString})"`;

    if (options.warningsEnabled) {
      if (!keyParamsString) {
        options.warningsCallback(`${options.displayName} generated an empty keyParamsString`, {
          keyParams,
          keyParamsString,
          state,
        });
      } else if (keyParamsString.length > 100) {
        options.warningsCallback(`${options.displayName} generated an unusually long keyParamsString`, {
          keyParams,
          keyParamsString,
          state,
        });
      }
    }

    const previousResult = previousResultsByParam[keyParamsString];
    let canUsePreviousResult = false; // until proven otherwise

    if (options.verboseLoggingEnabled && options.useConsoleGroup) {
      console.groupCollapsed(`${verboseLoggingPrefix}.getPreviousResultInfo()`, {
        parentCaller,
        state,
        keyParams,
        keyParamsString,
        additionalArgs,
        verboseLoggingPrefix,
        previousResult,
        canUsePreviousResult,
      });
    }

    if (previousResult) {
      // compareIncomingStates is only honored for root selectors
      // @TODO: Need to warn if it's set for a non-root selector
      if (state && previousResult.state
        && (isRootSelector ? compareIncomingStates(previousResult.state, state) : state === previousResult.state)
      ) {
        canUsePreviousResult = true;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${verboseLoggingPrefix} doesn't need to re-run because state didn't change`);
        }
      }

      // If canUsePreviousResult is true at this point then we've matched scenario A above

      if (!canUsePreviousResult && !isRootSelector && previousResult.dependencies.length > 0) {
        // We need to check the prior dependencies to see if they've actually changed.
        // @TODO: Need to warn if a root selector has/calls any dependencies
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${verboseLoggingPrefix} is testing its dependencies...`);
        }

        let anyDependencyHasChanged = false; // until proven guilty
        for (let i = 0; i < previousResult.dependencies.length; i += 1) {
          const [previousSelector, previousKeyParams, previousReturnValue] = previousResult.dependencies[i];

          // Since we're only checking dependencies, we don't want child selectors to change anything.
          // This will give them a 'parentCaller.recordDependencies: false'
          parameterizedSelectorCallStack.push({
            state,
            isCheckingDependenciesOnly: true,
          });

          // Does our previous dependency have anything new?
          const newReturnValue = previousSelector(previousKeyParams, ...additionalArgs);

          parameterizedSelectorCallStack.pop();

          if (previousReturnValue !== newReturnValue) {
            anyDependencyHasChanged = true;
            if (options.verboseLoggingEnabled) {
              const previousKeyParamString = previousSelector.createKeyFromParams(previousKeyParams);
              options.verboseLoggingCallback(`${verboseLoggingPrefix} needs to re-run because "${previousSelector.displayName}(${previousKeyParamString})" returned a new value.`);
            }
            break;
          }
        }
        if (!anyDependencyHasChanged) {
          // Scenario B
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${verboseLoggingPrefix} doesn't need to re-run because no dependencies changed`);
          }
          canUsePreviousResult = true;
        }
      }
    }

    if (options.verboseLoggingEnabled && options.useConsoleGroup) {
      console.groupEnd();
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

    if (options.verboseLoggingEnabled && options.useConsoleGroup) {
      console.groupCollapsed(`${verboseLoggingPrefix} has state:`, {
        parentCaller,
        state,
        keyParams,
        keyParamsString,
        additionalArgs,
        verboseLoggingPrefix,
        previousResult,
        canUsePreviousResult,
      });
    }

    if (options.verboseLoggingEnabled && !previousResult) {
      options.verboseLoggingCallback(`${verboseLoggingPrefix} is running for the first time`);
    }

    // If canUsePreviousResult is true at this point then we've matched scenario A or B above,
    // else we need to re-run (scenario C)

    let returnValue;
    if (canUsePreviousResult) {
      if (options.performanceChecksEnabled) {
        totalCallCount += 1;
        previousResult.callCount += 1;
      }

      ({ returnValue } = previousResult);
    } else {
      const newResult = {
        state,
        recordDependencies: !(hasStaticDependencies && previousResult),
        dependencies: (hasStaticDependencies && previousResult) ? previousResult.dependencies : [],
        returnValue: null,
        // Note that these counts will get overwritten immediately below (if performance checks are on)
        callCount: 1,
        recomputationCount: 0,
      };

      if (options.performanceChecksEnabled) {
        totalCallCount += 1;
        if (previousResult) {
          totalRecomputationCount += 1;
          newResult.callCount = previousResult.callCount + 1;
          newResult.recomputationCount = previousResult.recomputationCount + 1;

          // While we're here, let's make sure the selector isn't recomputing too often.
          // @TODO: Is it worth making an option for this 75% value?
          if (newResult.callCount > 2 && newResult.recomputationCount > 0.75 * newResult.callCount) {
            options.performanceChecksCallback(`${verboseLoggingPrefix} is recomputing a lot: ${newResult.recomputationCount} of ${newResult.callCount} runs.`);
          } else if (totalCallCount > 5 && totalRecomputationCount > 0.75 * totalCallCount) {
            options.performanceChecksCallback(`${options.displayName} is recomputing a lot in total: ${totalRecomputationCount} of ${totalCallCount} runs.`);
          }
        }
      }

      // Collect dependencies, if appropriate
      parameterizedSelectorCallStack.push(newResult);

      try {
        if (isRootSelector) {
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${verboseLoggingPrefix} running as a root selector`, {
              state, keyParams, additionalArgs,
            });
          }
          returnValue = innerFn(state, keyParams, ...additionalArgs);
        } else {
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${verboseLoggingPrefix} running as a normal selector`, {
              state, keyParams, additionalArgs,
            });
          }
          returnValue = innerFn(keyParams, ...additionalArgs);
        }
      } catch (error) {
        options.warningsCallback(`${verboseLoggingPrefix} threw an exception: ${error.message}`, error);
        if (options.warningsEnabled) {
          console.trace();
        }
      }

      parameterizedSelectorCallStack.pop();
      newResult.recordDependencies = false;

      if (previousResult && compareSelectorResults(previousResult.returnValue, returnValue)) {
        // We got back the same result: return what we had before and update the record
        ({ returnValue } = previousResult);
        newResult.returnValue = returnValue;
        previousResultsByParam[keyParamsString] = newResult;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${verboseLoggingPrefix} didn't need to re-run: the result is the same`, {
            previousResult,
            newResult,
          });
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

    if (options.verboseLoggingEnabled && options.useConsoleGroup) {
      console.groupEnd(`${verboseLoggingPrefix} is done.`, {
        parentCaller,
        effectiveResult: previousResultsByParam[keyParamsString],
        returnValue,
      });
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

  parameterizedSelector.getTotalCallCount = () => totalCallCount;
  parameterizedSelector.getTotalRecomputations = () => totalRecomputationCount;

  parameterizedSelector.getCallCountForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const previousResult = previousResultsByParam[keyParamsString];

    return previousResult ? previousResult.callCount : 0;
  };
  parameterizedSelector.getRecomputationsForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const previousResult = previousResultsByParam[keyParamsString];

    return previousResult ? previousResult.recomputationCount : 0;
  };

  parameterizedSelector.isParameterizedSelector = true;
  parameterizedSelector.displayName = options.displayName;
  parameterizedSelector.isRootSelector = isRootSelector;
  parameterizedSelector.createKeyFromParams = createKeyFromParams;

  return parameterizedSelector;
};


/**
 * If you want the parameterizedSelectorFactory to have different defaults options, use this to create
 * a version that has the options you want.
 */
parameterizedSelectorFactory.withOptions = localOptions => // eslint-disable-next-line implicit-arrow-linebreak
  (innerFn, options = {}) => parameterizedSelectorFactory(innerFn, {
    ...localOptions,
    ...options,
  });


export default parameterizedSelectorFactory;
