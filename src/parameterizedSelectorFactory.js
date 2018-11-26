import { defaultOptions } from './defaultOptions';


/**
 * When any parameterizedSelector is run, we'll add it to this stack so that *other* parameterizedSelectors
 * can register themselves as dependencies for it. This let us know which dependencies to dirty-check
 * the next time it runs.
 *
 * This single instance is used forever across all selectors.
 */
const parameterizedSelectorCallStack = [];

const getTopCallStackEntry = () => parameterizedSelectorCallStack.length
  && parameterizedSelectorCallStack[parameterizedSelectorCallStack.length - 1];

/**
 * For performance, this function ensures all entries on the call stack have the same shape.
 * `state` and `hasStaticDependencies` are mandatory for each call.
 */
const pushCallStackEntry = (state, hasStaticDependencies, overrideValues = {}) => {
  const topOfCallStack = getTopCallStackEntry();

  const callStackEntry = {
    state,
    hasStaticDependencies,
    dependencies: [],
    canReRun: topOfCallStack ? topOfCallStack.canReRun : true,
    shouldRecordDependencies: true,
    ...overrideValues,
  };
  // @TODO: Warn if given any unrecognized or deprecated values

  parameterizedSelectorCallStack.push(callStackEntry);
  return callStackEntry;
};

const popCallStackEntry = () => parameterizedSelectorCallStack.pop();


/**
 * Like pushCallStackEntry, this function ensures that the resultRecord objects always have the same shape,
 * and requires `state` be passed as a required arg.
 */
const createResultRecord = (state, previousResult = {}, overrideValues = {}) => {
  const result = {
    state,
    dependencies: previousResult.dependencies || [],
    hasReturnValue: false,
    returnValue: null,
    error: null,
    // Note that these counts must be incremented separately (if performance checks are on)
    callCount: previousResult.callCount || 1,
    recomputationCount: previousResult.recomputationCount || 0,
    ...overrideValues,
  };
  return result;
};


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
   *    hasReturnValue,
   *    returnValue,
   *    error,
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
   * This is the key function that performs all selector work (although it's NOT the function returned
   * to the outside caller.)
   *
   * The basic idea is that the selector function's behavior depends on what its parent wants --
   * that info is provided in `parameterizedSelectorCallStack` -- and because there are different behaviors,
   * like how or whether to record dependencies, the code can be much clearer if we separate the caller/parent
   * control from the internal logic here. So the functions exposed handle the "caller/parent" part and
   * then hand control to this key function.
   *
   * Internally, the overall algorithm is:
   *  1. If we've never run for the given state+params before, skip to step 4. (Else we'll try to avoid re-running.)
   *  2. If the state is the same as before, return the prior result.
   *      - If we're a root selector then we have some extra options for deciding about "state is the same as before".
   *  3. Check our dependencies to see if any of them have changed:
   *      We'll execute each dependency (in a lightweight mode), and compare the new result to what we received
   *      the previous time. If every one of them gave us the exact same object we got last time, skip to step 6.
   *  4. We need to re-run: put some info onto the call stack and run the inner function.
   *  5. Check the result: if it's indistinguishable from what the inner function returned before, reuse the old value.
   *      - This was a needless re-run, but by returning the prior value we can help other selectors and consumers
   *        avoid re-running needlessly as well.
   *  6. At this point we have our return value: mark any dependency metadata that our parent might have
   *      requested, then finally return.
   *
   * Or, from a different perspective: there are three possible outcomes whenever this gets called:
   *  A) Nothing relevant has changed about the state since the last time we ran.
   *  B) Nothing has changed for our dependencies since the last time we ran.
   *  C) We needed to run so we did -- and if that turned out to be needless, we pretended it didn't happen.
   */
  const evaluateParameterizedSelector = (state, keyParams, ...additionalArgs) => {
    const parentCaller = getTopCallStackEntry();

    const keyParamsString = createKeyFromParams(keyParams);
    const previousResult = previousResultsByParam[keyParamsString];

    const loggingPrefix = `Parameterized selector "${options.displayName}(${keyParamsString})"`;

    if (options.verboseLoggingEnabled && options.useConsoleGroup) {
      console.groupCollapsed(`Starting ${loggingPrefix}`, { // eslint-disable-line no-console
        parentCaller,
        state,
        keyParams,
        keyParamsString,
        additionalArgs,
        previousResult,
      });
    } else if (options.verboseLoggingEnabled) {
      options.verboseLoggingCallback(`Starting ${loggingPrefix}`, {
        parentCaller,
        state,
        keyParams,
        keyParamsString,
        additionalArgs,
        previousResult,
      });
    }

    if (options.warningsEnabled) {
      if (!keyParamsString) {
        options.warningsCallback(`${options.displayName} generated an empty keyParamsString`, {
          keyParams,
          keyParamsString,
          state,
        });
      } else if (keyParamsString.length > 100) { // @TODO: Make this value a configurable option
        options.warningsCallback(`${options.displayName} generated an unusually long keyParamsString`, {
          keyParams,
          keyParamsString,
          state,
        });
      }
    }

    // Step 1: Do we have a prior result for this parameterizedSelector + its keyParams?
    let canUsePreviousResult = false; // until proven otherwise

    if (previousResult && previousResult.hasReturnValue) {
      const {
        state: previousState,
        dependencies: previousDependencies,
        // Note that callCount and recomputationCount are only referenced if they're actually in use.
      } = previousResult;

      // Step 2: Have we already run with these params for this state?
      // compareIncomingStates is only honored for root selectors
      // @TODO: Need to warn if compareIncomingStates is set for a non-root selector
      if (state && previousState && ((isRootSelector && compareIncomingStates)
        ? compareIncomingStates(previousState, state)
        : state === previousState
      )) {
        canUsePreviousResult = true;
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${loggingPrefix} is cached: state hasn't changed`);
        }
      } else if (!isRootSelector && previousDependencies.length > 0) {
        // Step 3: Have any of our dependencies changed?
        // @TODO: Need to warn if a root selector ever has dependencies
        let anyDependencyHasChanged = false; // until proven guilty

        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${loggingPrefix} is checking its dependencies for changes...`);
        }

        // Since we're only checking dependencies, we want to minimize any extra work the child selectors
        // could do.
        pushCallStackEntry(state, hasStaticDependencies, {
          shouldRecordDependencies: false,
        });

        for (let i = 0; i < previousDependencies.length; i += 1) {
          const [dependencySelector, dependencyKeyParams, dependencyReturnValue] = previousDependencies[i];

          // Does our dependency have anything new?
          const result = dependencySelector.directRunFromParent(state, dependencyKeyParams, ...additionalArgs);
          // The selector function itself returns some additional metadata alongside the returnValue,
          // to cover exceptions and edge cases like not being allowed to rerun when needed.
          const {
            hasReturnValue,
            returnValue: newReturnValue,
          } = result;

          if (hasReturnValue && newReturnValue !== dependencyReturnValue) {
            anyDependencyHasChanged = true;
            if (options.verboseLoggingEnabled) {
              const dependencyKeyParamString = dependencySelector.createKeyFromParams(dependencyKeyParams);
              options.verboseLoggingCallback(`${loggingPrefix} is dirty: "${dependencySelector.displayName}(${dependencyKeyParamString})" returned a new value.`);
            }
            break;
          }
        }
        popCallStackEntry();

        if (!anyDependencyHasChanged) {
          canUsePreviousResult = true;
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${loggingPrefix} is cached: no dependencies have changed`);
          }
        }
      }
    }

    // We need to return a bunch of metaData along with the returnValue, at the very end. Instead of tracking
    // a handful of separate variables, everything will be accumulated here.
    let newResult;

    if (canUsePreviousResult) {
      newResult = previousResult;

      if (options.performanceChecksEnabled) {
        totalCallCount += 1;
        newResult.callCount += 1;
      }
    } else {
      // Step 4: Run and obtain a new result, if we can.
      newResult = createResultRecord(state, previousResult);

      if (parentCaller.canReRun) {
        // Collect dependencies, if appropriate
        pushCallStackEntry(state, hasStaticDependencies);

        try {
          let returnValue;
          if (isRootSelector) {
            if (options.verboseLoggingEnabled) {
              options.verboseLoggingCallback(`Running ${loggingPrefix} as a root selector`, {
                state, keyParams, additionalArgs,
              });
            }
            returnValue = innerFn(state, keyParams, ...additionalArgs);
          } else {
            if (options.verboseLoggingEnabled) {
              options.verboseLoggingCallback(`Running ${loggingPrefix} as a normal selector`, {
                state, keyParams, additionalArgs,
              });
            }
            returnValue = innerFn(keyParams, ...additionalArgs);
          }
          // If we reach this point without error, all is well
          newResult.hasReturnValue = true;
          newResult.returnValue = returnValue;
        } catch (errorFromInnerFn) {
          newResult.error = errorFromInnerFn;

          options.warningsCallback(`${loggingPrefix} threw an exception: ${newResult.error.message}`, newResult.error);
          if (options.warningsEnabled) {
            console.trace(); // eslint-disable-line no-console
          }
        }
        const callStackEntry = popCallStackEntry();

        // Step 5: Did we really get back a new value?
        if (previousResult && previousResult.hasReturnValue && newResult.hasReturnValue
          && compareSelectorResults(previousResult.returnValue, newResult.returnValue)
        ) {
          // We got back the same result: return what we had before
          newResult = previousResult;
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${loggingPrefix} didn't need to re-run: the result is the same`, {
              previousResult,
              newResult,
            });
          }
        } else {
          // It really IS new!
          previousResultsByParam[keyParamsString] = newResult;
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${loggingPrefix} has a new return value: `, newResult.returnValue);
          }
        }

        if (!newResult.error && callStackEntry.dependencies.length) {
          // Carry over the bookkeeping records of whatever sub-selectors were run within innerFn.
          newResult.dependencies = callStackEntry.dependencies;

          if (options.warningsEnabled && isRootSelector) {
            options.warningsCallback(`${loggingPrefix} is supposed to be a root selector, but it recorded dependencies`, {
              callStackEntry,
            });
            // @TODO: Maybe add some intermittent checks around hasStaticDependencies when in dev mode,
            // to have it warn if something should be static but isn't, or if it always records the same set.
          }
        }

        if (options.performanceChecksEnabled) {
          totalCallCount += 1;
          if (previousResult) {
            totalRecomputationCount += 1;
            newResult.callCount += 1;
            newResult.recomputationCount += 1;

            // While we're here, let's make sure the selector isn't recomputing too often.
            // @TODO: Make overrideable options for these values
            if (newResult.callCount > 2 && newResult.recomputationCount > 0.75 * newResult.callCount) {
              options.performanceChecksCallback(`${loggingPrefix} is recomputing a lot: ${newResult.recomputationCount} of ${newResult.callCount} runs.`);
            } else if (totalCallCount > 5 && totalRecomputationCount > 0.75 * totalCallCount) {
              options.performanceChecksCallback(`${options.displayName} is recomputing a lot in total: ${totalRecomputationCount} of ${totalCallCount} runs.`);
            }
          }
        }
      } else {
        // We need to re-run, but the parentCaller told us not to, so the default `hasReturnValue: false`
        // will pass through.
        previousResultsByParam[keyParamsString] = newResult;
      }
    }

    // Step 6: All our work is done -- but we may need to add an entry to let the parent/caller parameterizedSelector
    // know that this one was called, regardless of our cached/dirty state.
    if (parentCaller && parentCaller.shouldRecordDependencies) {
      // @TODO: Split this into separate functions so that they can be ordered in definition order
      // eslint-disable-next-line no-use-before-define
      parentCaller.dependencies.push([parameterizedSelector, keyParams, newResult.returnValue]);
    }

    if (options.verboseLoggingEnabled) {
      if (newResult === previousResult) {
        options.verboseLoggingCallback(`${loggingPrefix} is done, with no change`);
      } else {
        options.verboseLoggingCallback(`${loggingPrefix} is done, with a new result: `, newResult);
      }
      if (options.useConsoleGroup) {
        console.groupEnd(); // eslint-disable-line no-console
      }
    }

    return newResult;
  };


  /**
   * Most of the 'public' entry points can be called from either a "with state" context or a "without state"
   * context. We use this to avoid doubling the argument-massaging logic in each of them.
   */
  const getArgumentsFromExternalCall = (args) => {
    const parentCaller = getTopCallStackEntry();
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

    return [state, keyParams, ...additionalArgs];
  };

  /*
   * This is the 'public' selector function. You can call it like normal and it behaves like a normal function;
   * it's just a straightforward wrapper around evaluateParameterizedSelector for handling the common case.
   */
  function parameterizedSelector(...args) {
    const isNewStart = !getTopCallStackEntry();
    const argsWithState = getArgumentsFromExternalCall(args);

    if (isNewStart) {
      pushCallStackEntry(argsWithState[0], hasStaticDependencies);
    }
    const result = evaluateParameterizedSelector(...argsWithState);
    if (isNewStart) {
      popCallStackEntry();
    }

    if (result.error) {
      throw result.error;
    }
    return result.returnValue;
  }

  // This lets selectors bypass the wrappers internally, when appropriate. It shouldn't be called from
  // outside of this file (and tests), though.
  parameterizedSelector.directRunFromParent = evaluateParameterizedSelector;

  /**
   * This offers a way to inspect a parameterizedSelector call's status without calling it.
   * Note that *dependencies* may be called, however, to determine whether their values are still valid.
   *
   * @TODO: Maybe add a flag to distinguish 'cheap' dependencies from expensive ones, and use that to
   *        decide when/whether to re-run the dependencies to see if they've changed.
   */
  parameterizedSelector.hasCachedResult = (...args) => {
    const topOfCallStack = !getTopCallStackEntry();
    const argsWithState = getArgumentsFromExternalCall(args);

    pushCallStackEntry(argsWithState[0], hasStaticDependencies, {
      dependencies: topOfCallStack ? topOfCallStack.dependencies : [],
      canReRun: false,
    });
    const result = evaluateParameterizedSelector(...argsWithState);
    popCallStackEntry();

    return result.hasReturnValue;
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
