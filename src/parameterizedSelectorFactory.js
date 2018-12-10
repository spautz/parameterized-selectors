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
 * As selectors are executed, we use call stack entries to know which 'child' selectors each 'parent'
 * depends on. We track both the immediate dependencies and (for performance) the eventual root selectors
 * that get called, for each set of params.
 *
 * For performance, this function ensures all entries on the call stack have the same shape.
 * `state` and `hasStaticDependencies` are mandatory for each call.
 */
const pushCallStackEntry = (state, hasStaticDependencies, overrideValues = {}) => {
  const topOfCallStack = getTopCallStackEntry();

  const callStackEntry = {
    state,
    rootDependencies: [],
    ownDependencies: [],
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
 * A "result record" tracks the last result -- anywhere/globally -- of running the selector with a particular
 * state and set of params. These records are mutated and persistent.
 *
 * These are used with "dependency records" (which are parent-specific instead of global) to determine
 * whether a selector needs to re-run: if either the result record is out-of-date or the dependency record
 * doesn't match it, then the dependency needs to be re-checked.
 *
 * Like pushCallStackEntry, this function ensures that the resultRecord objects always have the same shape,
 * and requires `state` be passed as a required arg.
 */
const createResultRecord = state => ({
  state,
  rootDependencies: [],
  ownDependencies: [],
  hasReturnValue: false,
  returnValue: null,
  error: null,
  invokeCount: 0,
  skippedRunCount: 0,
  phantomRunCount: 0,
  fullRunCount: 0,
  abortedRunCount: 0,
  errorRunCount: 0,
});


const hasAnyDependencyChanged = (state, dependencyRecordList, options, loggingPrefix, additionalArgs = []) => {
  const dependencyListLength = dependencyRecordList.length;
  for (let i = 0; i < dependencyListLength; i += 1) {
    const [dependencySelector, dependencyKeyParams, dependencyReturnValue] = dependencyRecordList[i];

    // Does our dependency have anything new?
    const resultRecord = dependencySelector.directRunFromParent(state, dependencyKeyParams, ...additionalArgs);
    // The selector function itself returns some additional metadata alongside the returnValue,
    // to cover exceptions and edge cases like not being able to run.
    const {
      hasReturnValue,
      returnValue: newReturnValue,
    } = resultRecord;

    if (!hasReturnValue) {
      if (options.verboseLoggingEnabled) {
        const dependencyKeyParamString = dependencySelector.createKeyFromParams(dependencyKeyParams);
        options.verboseLoggingCallback(`${loggingPrefix} is dirty: "${dependencySelector.displayName}(${dependencyKeyParamString})" could not run.`);
      }
      return true;
    }
    if (newReturnValue !== dependencyReturnValue) {
      if (options.verboseLoggingEnabled) {
        const dependencyKeyParamString = dependencySelector.createKeyFromParams(dependencyKeyParams);
        options.verboseLoggingCallback(`${loggingPrefix} is dirty: "${dependencySelector.displayName}(${dependencyKeyParamString})" returned a new value.`);
      }
      return true;
    }
  }
  return false;
};


/**
 * Each selector needs a unique displayName. We'll pull that from options or the innerFn if possible,
 * but if we have to fall back to raw numbers we'll use this counter to keep them distinct.
 */
let numUnnamedSelectors = 0;


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
      options.displayName = `${options.displayNamePrefix}${functionDisplayName}`;
    } else {
      numUnnamedSelectors += 1;
      options.displayName = `${options.displayNamePrefix}${numUnnamedSelectors}`;
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
   *    rootDependencies: [
   *      [parameterizedSelector, keyParams, returnValue], // dependency records
   *      ...
   *    ],
   *    ownDependencies: [
   *      [parameterizedSelector, keyParams, returnValue], // dependency records
   *      ...
   *    ],
   *    hasReturnValue,
   *    returnValue,
   *    error,
   *    invokeCount,
   *    skippedRunCount,
   *    phantomRunCount,
   *    fullRunCount,
   *    abortedRunCount,
   *    errorRunCount,
   *  }
   */
  const resultRecordsByParam = {};

  /**
   * Here we can track the number of recomputations due to cache misses, state changes, param changes etc,
   * and the number of times the selector was ever called (regardless of whether it recomputed.)
   * This is primarily used for performance and unit-testing purposes.
   *
   * Note that these counts apply across ALL params for the selector. There is a separate set of per-param
   * counters, tracked in the individual resultRecords.
   */
  let globalInvokeCount = 0;
  let globalSkippedRunCount = 0;
  let globalPhantomRunCount = 0;
  let globalFullRunCount = 0;
  let globalAbortedRunCount = 0;
  let globalErrorRunCount = 0;


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
   *        * This is done first by checkout our "root" dependencies (root selectors that should run super-fast),
   *          then checking our dependencies' "root" dependencies, and then finally by checking the intermediate
   *          selectors that live between them.
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

    if (!hasOwnProperty.call(resultRecordsByParam, keyParamsString)) {
      resultRecordsByParam[keyParamsString] = createResultRecord(state);
    }
    const resultRecord = resultRecordsByParam[keyParamsString];

    const loggingPrefix = `"${options.displayName}(${keyParamsString})"`;

    if (options.verboseLoggingEnabled && options.useConsoleGroup) {
      console.groupCollapsed(`Starting ${loggingPrefix}`, { // eslint-disable-line no-console
        parentCaller,
        state,
        keyParams,
        keyParamsString,
        additionalArgs,
        resultRecord,
      });
    } else if (options.verboseLoggingEnabled) {
      options.verboseLoggingCallback(`Starting ${loggingPrefix}`, {
        parentCaller,
        state,
        keyParams,
        keyParamsString,
        additionalArgs,
        resultRecord,
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

    if (options.performanceChecksEnabled) {
      globalInvokeCount += 1;
      resultRecord.invokeCount += 1;
    }
    if (options.runLoggingEnabled) {
      console.group(`Invoke: ${loggingPrefix}`);
    }
    if (typeof options.onInvoke === 'function') {
      options.onInvoke(keyParams, resultRecord);
    }

    // Step 1: Do we have a prior result for this parameterizedSelector + its keyParams?
    let canUsePreviousResult = false; // until proven otherwise

    if (resultRecord.hasReturnValue) {
      const {
        state: previousState,
        rootDependencies: previousRootDependencies,
        ownDependencies: previousOwnDependencies,
        // Note that the count vars are only referenced if they're actually in use.
      } = resultRecord;

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
      } else if (!isRootSelector && (previousRootDependencies.length > 0 || previousOwnDependencies.length > 0)) {
        // Step 3: Have any of our dependencies changed?
        // @TODO: Need to warn if a root selector ever has dependencies

        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${loggingPrefix} is checking its dependencies for changes...`);
        }

        // We'll check the root dependencies first: if one of them has changed, we'll check our own direct dependencies.
        // If one of those has also changed, then we need to rerun.
        const hasChanges = hasAnyDependencyChanged(state, previousRootDependencies, options, loggingPrefix, additionalArgs) // eslint-disable-line max-len
          && hasAnyDependencyChanged(state, previousOwnDependencies, options, loggingPrefix, additionalArgs);

        if (!hasChanges) {
          canUsePreviousResult = true;
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`${loggingPrefix} is cached: no dependencies have changed`);
          }
        }
      }
    }

    // Regardless of whether we skip, rerun, phantom run, etc, we need to note that we did this work for
    // this particular state.
    resultRecord.state = state;

    if (canUsePreviousResult) {
      if (options.performanceChecksEnabled) {
        globalSkippedRunCount += 1;
        resultRecord.skippedRunCount += 1;
      }
      if (options.runLoggingEnabled) {
        options.runLoggingCallback(`Skipped run: ${loggingPrefix}`);
        console.groupEnd();
      }

      if (typeof options.onSkippedRun === 'function') {
        options.onSkippedRun(keyParams, resultRecord);
      }
    } else if (!parentCaller.canReRun) {
      // We need to re-run, but the parentCaller told us not to
      resultRecord.hasReturnValue = false;

      if (options.performanceChecksEnabled) {
        globalAbortedRunCount += 1;
        resultRecord.abortedRunCount += 1;
      }
      if (options.runLoggingEnabled) {
        options.runLoggingCallback(`Aborted run: ${loggingPrefix}`);
        console.groupEnd();
      }
      if (typeof options.onAbortedRun === 'function') {
        options.onAbortedRun(keyParams, resultRecord);
      }
    } else {
      // Step 4: Run and obtain a new result, if we can.
      const oldReturnValue = resultRecord.returnValue;
      let newReturnValue;
      let newError;

      pushCallStackEntry(state, hasStaticDependencies);
      try {
        if (isRootSelector) {
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`Running ${loggingPrefix} as a root selector`, {
              state, keyParams, additionalArgs,
            });
          }
          newReturnValue = innerFn(state, keyParams, ...additionalArgs);
        } else {
          if (options.verboseLoggingEnabled) {
            options.verboseLoggingCallback(`Running ${loggingPrefix} as a normal selector`, {
              state, keyParams, additionalArgs,
            });
          }
          newReturnValue = innerFn(keyParams, ...additionalArgs);
        }
        // If we reach this point without error, all is well
      } catch (errorFromInnerFn) {
        newError = errorFromInnerFn;
      }
      const callStackEntry = popCallStackEntry();

      // Step 5: Let's look at what we got back
      if (newError) {
        // Oh no!
        resultRecord.returnValue = undefined;
        resultRecord.hasReturnValue = false;
        resultRecord.error = newError;

        if (options.performanceChecksEnabled) {
          globalErrorRunCount += 1;
          resultRecord.errorRunCount += 1;
        }

        if (options.warningsEnabled) {
          options.warningsCallback(`${loggingPrefix} threw an exception: ${newError.message}`, newError);
          console.trace(); // eslint-disable-line no-console
        }
        if (options.runLoggingEnabled) {
          options.runLoggingCallback(`Error run: ${loggingPrefix}`);
          console.groupEnd();
        }
        if (typeof options.onErrorRun === 'function') {
          options.onErrorRun(oldReturnValue, undefined, keyParams, resultRecord);
        }
      } else if (resultRecord.hasReturnValue && compareSelectorResults(oldReturnValue, newReturnValue)) {
        // We got back an equivalent result to what we had before. No need to update.
        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${loggingPrefix} didn't need to re-run: the result is the same`, {
            resultRecord,
          });
        }

        if (options.performanceChecksEnabled) {
          globalPhantomRunCount += 1;
          resultRecord.phantomRunCount += 1;
        }
        if (options.runLoggingEnabled) {
          options.runLoggingCallback(`Phantom run: ${loggingPrefix}`);
          console.groupEnd();
        }
        if (typeof options.onPhantomRun === 'function') {
          // To better align with the other after-run callbacks, the 'new' value is sent as if it were the old value,
          // so that the actual return value comes second.
          options.onPhantomRun(newReturnValue, oldReturnValue, keyParams, resultRecord);
        }
      } else {
        // It's a genuinely new value!
        resultRecord.returnValue = newReturnValue;
        resultRecord.hasReturnValue = true;
        resultRecord.error = undefined;

        if (options.verboseLoggingEnabled) {
          options.verboseLoggingCallback(`${loggingPrefix} has a new return value: `, newReturnValue);
        }

        if (options.performanceChecksEnabled) {
          globalFullRunCount += 1;
          resultRecord.fullRunCount += 1;
        }
        if (options.runLoggingEnabled) {
          options.runLoggingCallback(`Full run: ${loggingPrefix}`);
          console.groupEnd();
        }
        if (typeof options.onFullRun === 'function') {
          options.onFullRun(oldReturnValue, newReturnValue, keyParams, resultRecord);
        }
      }
      // At this point, the values in resultRecord are all up-to-date

      if (!resultRecord.error && (callStackEntry.rootDependencies.length || callStackEntry.ownDependencies.length)) {
        // Update our dependencyRecords, so we know which sub-selectors were run within innerFn.
        resultRecord.rootDependencies = callStackEntry.rootDependencies;
        resultRecord.ownDependencies = callStackEntry.ownDependencies;

        if (options.warningsEnabled && isRootSelector) {
          options.warningsCallback(`${loggingPrefix} is supposed to be a root selector, but it recorded dependencies`, {
            callStackEntry,
          });
          // @TODO: Maybe add some intermittent checks around hasStaticDependencies when in dev mode,
          // to have it warn if something should be static but isn't, or if it always records the same set.
        }
      }

      if (options.performanceChecksEnabled) {
        // While we're here, let's make sure the selector isn't recomputing too often.
        // @TODO: Make overrideable options for these values
        if (resultRecord.invokeCount > 5 && resultRecord.fullRunCount > 0.75 * resultRecord.invokeCount) {
          options.performanceChecksCallback(`${loggingPrefix} is recomputing a lot: ${resultRecord.fullRunCount} of ${resultRecord.invokeCount} runs gave new results.`);
        } else if (globalInvokeCount > 25 && globalFullRunCount > 0.75 * globalInvokeCount) {
          options.performanceChecksCallback(`${options.displayName} is recomputing a lot in total: ${globalFullRunCount} of ${globalInvokeCount} runs gave new results.`);
        }
      }
    }

    // Step 6: All our work is done -- but we may need to add an entry to let the parent/caller parameterizedSelector
    // know that this one was called, regardless of our cached/dirty state.
    if (parentCaller && parentCaller.shouldRecordDependencies) {
      // @TODO: Split this into separate functions so that they can be ordered in definition order
      // Regardless of whether or not it's a root dependency, we need to track it as *our own* immediate dependency
      parentCaller.ownDependencies.push(
        // eslint-disable-next-line no-use-before-define
        [parameterizedSelector, keyParams, resultRecord.returnValue],
      );
    }

    if (isRootSelector) {
      const callStackLength = parameterizedSelectorCallStack.length;
      for (let i = 0; i < callStackLength; i += 1) {
        const callStackEntry = parameterizedSelectorCallStack[i];
        if (callStackEntry.shouldRecordDependencies) {
          callStackEntry.rootDependencies.push(
            // *Each* items in the stack gets its own, separate copy of the dependencyRecord
            // eslint-disable-next-line no-use-before-define
            [parameterizedSelector, keyParams, resultRecord.returnValue],
          );
        }
      }
    }

    if (options.verboseLoggingEnabled) {
      options.verboseLoggingCallback(`${loggingPrefix} is done`, resultRecord);
      if (options.useConsoleGroup) {
        console.groupEnd(); // eslint-disable-line no-console
      }
    }

    return resultRecord;
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

  /**
   * This lets selectors bypass the wrappers internally, when appropriate. It shouldn't be called from
   * outside of this file (and tests), though.
   */
  parameterizedSelector.directRunFromParent = evaluateParameterizedSelector;

  /**
   * This is useful for debugging, but should not be used otherwise.
   */
  parameterizedSelector.getResultRecord = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    return resultRecordsByParam[keyParamsString];
  };

  /**
   * This offers a way to inspect a parameterizedSelector call's status without calling it.
   * Note that *dependencies* may be called, however, to determine whether their values are still valid.
   *
   * @TODO: Maybe add a flag to distinguish 'cheap' dependencies from expensive ones, and use that to
   *        decide when/whether to re-run the dependencies to see if they've changed.
   */
  parameterizedSelector.hasCachedResult = (...args) => {
    // const parentCaller = getTopCallStackEntry();
    const argsWithState = getArgumentsFromExternalCall(args);

    // if (parentCaller) {
    //   pushCallStackEntry(argsWithState[0], hasStaticDependencies, {
    //     // When checking for results
    //     ownDependencies: parentCaller.ownDependencies,
    //     canReRun: false,
    //   });
    // } else {
    pushCallStackEntry(argsWithState[0], hasStaticDependencies, {
      canReRun: false,
    });
    // }
    const result = evaluateParameterizedSelector(...argsWithState);
    popCallStackEntry();

    return result.hasReturnValue;
  };

  parameterizedSelector.getGlobalInvokeCount = () => globalInvokeCount;
  parameterizedSelector.getGlobalSkippedRunCount = () => globalSkippedRunCount;
  parameterizedSelector.getGlobalPhantomRunCount = () => globalPhantomRunCount;
  parameterizedSelector.getGlobalFullRunCount = () => globalFullRunCount;
  parameterizedSelector.getGlobalAbortedRunCount = () => globalAbortedRunCount;
  parameterizedSelector.getGlobalErrorRunCount = () => globalErrorRunCount;
  parameterizedSelector.getAllGlobalCounts = () => ({
    globalInvokeCount,
    globalSkippedRunCount,
    globalPhantomRunCount,
    globalFullRunCount,
    globalAbortedRunCount,
    globalErrorRunCount,
  });

  parameterizedSelector.getInvokeCountForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const resultRecord = resultRecordsByParam[keyParamsString];
    return resultRecord ? resultRecord.invokeCount : 0;
  };
  parameterizedSelector.getSkippedRunCountForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const resultRecord = resultRecordsByParam[keyParamsString];
    return resultRecord ? resultRecord.skippedRunCount : 0;
  };
  parameterizedSelector.getPhantomRunCountForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const resultRecord = resultRecordsByParam[keyParamsString];
    return resultRecord ? resultRecord.phantomRunCount : 0;
  };
  parameterizedSelector.getFullRunCountForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const resultRecord = resultRecordsByParam[keyParamsString];
    return resultRecord ? resultRecord.fullRunCount : 0;
  };
  parameterizedSelector.getAbortedRunCountForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const resultRecord = resultRecordsByParam[keyParamsString];
    return resultRecord ? resultRecord.abortedRunCount : 0;
  };
  parameterizedSelector.getErrorRunCountForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const resultRecord = resultRecordsByParam[keyParamsString];
    return resultRecord ? resultRecord.errorRunCount : 0;
  };

  parameterizedSelector.getAllCountsForParams = (keyParams) => {
    const keyParamsString = createKeyFromParams(keyParams);
    const resultRecord = resultRecordsByParam[keyParamsString];
    return resultRecord
      ? {
        invokeCount: resultRecord.invokeCount,
        skippedRunCount: resultRecord.skippedRunCount,
        phantomRunCount: resultRecord.phantomRunCount,
        fullRunCount: resultRecord.fullRunCount,
        abortedRunCount: resultRecord.abortedRunCount,
        errorRunCount: resultRecord.errorRunCount,
      } : {
        invokeCount: 0,
        skippedRunCount: 0,
        phantomRunCount: 0,
        fullRunCount: 0,
        abortedRunCount: 0,
        errorRunCount: 0,
      };
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
