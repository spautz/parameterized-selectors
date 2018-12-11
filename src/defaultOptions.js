/* global __DEV__ */

import { COMPARISON_PRESETS } from './helpers';


/**
 * This is used to indicate options that *must* be set, either via localOptions when creating the selector
 * or via parameterizedSelectorFactory.withOptions.
 */
const willThrowErrorIfNotSet = label => () => {
  throw new Error(`parameterizedSelector: ${label} must be set.`);
};

/**
 * The default values used for some of the options are exported on their own, so that they can be referenced
 * if the consumer ever needs to reference the original value, after setting new defaults.
 */
const defaultInitialOptions = {
  displayNamePrefix: 'parameterizedSelector',
  compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
  compareSelectorResults: COMPARISON_PRESETS.SHALLOW_EQUAL,
  exceptionCallback: (errorMessage, error) => {
    console.error(errorMessage, error); // eslint-disable-line no-console
    throw error;
  },
};


const defaultOptions = {
  // Some options can only be set at initialization
  displayNamePrefix: defaultInitialOptions.displayNamePrefix,
  createKeyFromParams: willThrowErrorIfNotSet('createKeyFromParams'),
  compareIncomingStates: defaultInitialOptions.compareIncomingStates,
  compareSelectorResults: defaultInitialOptions.compareSelectorResults,
  isRootSelector: willThrowErrorIfNotSet('isRootSelector'),
  hasStaticDependencies: false,

  // Some options can be changed anytime
  displayName: null,
  useConsoleGroup: true,
  verboseLoggingEnabled: false,
  verboseLoggingCallback: console.log, /* eslint-disable-line no-console */
  performanceChecksEnabled: (typeof __DEV__ !== 'undefined' && !!__DEV__),
  performanceChecksCallback: console.log, /* eslint-disable-line no-console */
  warningsEnabled: true,
  warningsCallback: console.warn, /* eslint-disable-line no-console */
  exceptionCallback: defaultInitialOptions.exceptionCallback,
};

// Note that there is no `setDefaultOptions`:
// If you want the parameterizedSelectorFactory to have different default options, use the
// `parameterizedSelectorFactory.withOptions` helper to create a factory with those options bound.


export {
  defaultInitialOptions,
  defaultOptions,
};
