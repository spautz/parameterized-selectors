import { defaultInitialOptions } from './defaultOptions';
import { KEY_PRESETS, COMPARISON_PRESETS } from './helpers';
import parameterizedSelectorFactory from './parameterizedSelectorFactory';


// These two functions are set up with defaults that should work well generally.
// There's nothing special about them, though: if you have different needs you can create
// your own versions that apply different options.

const createParameterizedRootSelector = parameterizedSelectorFactory.withOptions({
  createKeyFromParams: KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS,
  compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
  compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY,
  isRootSelector: true,
});

const createParameterizedSelector = parameterizedSelectorFactory.withOptions({
  createKeyFromParams: KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS,
  compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY,
  isRootSelector: false,
});


// This is the complete list of *all* things exported.
export {
  KEY_PRESETS,
  COMPARISON_PRESETS,
  defaultInitialOptions,
  parameterizedSelectorFactory,
  createParameterizedRootSelector,
  createParameterizedSelector,
};
