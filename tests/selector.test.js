// TODO: Add test for React Redux connect function

import chai from 'chai';

import {
  KEY_PRESETS,
  COMPARISON_PRESETS,
  parameterizedSelectorFactory,
  createParameterizedRootSelector,
  createParameterizedSelector,
} from '../src/index';

const assert = chai.assert;

// Construct 1E6 states for perf test outside of the perf test so as to not change the execute time of the test function
const numOfStates = 1000000;
const states = [];

for (let i = 0; i < numOfStates; i++) {
  states.push({ a: 1, b: 2 });
}

describe('basic parameterized selector factory', () => {
  beforeEach(function () {
    // runs before each test in this block
  });
  it('should NOT increase # of recomputations when state or parameters changes', () => {
    const selectLetterById = parameterizedSelectorFactory.withOptions({
      createKeyFromParams: KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS,
      compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
      compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY,
      isRootSelector: true,
    })((state, id) => state.letterById[id]);

    const firstState = {
      letterById: {
        1: 'a',
      },
    };

    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById.getRecomputations(), 0);
  });
  it('should increase # of recomputations when state changes', () => {
    const selectLetterById = parameterizedSelectorFactory.withOptions({
      createKeyFromParams: KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS,
      compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
      compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY,
      isRootSelector: true,
    })((state, id) => state.letterById[id]);

    const firstState = {
      letterById: {
        1: 'a',
      },
    };

    const secondState = {
      letterById: {
        1: 'a',
        2: 'b',
      },
    };

    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById(secondState, 1), 'a');
    assert.equal(selectLetterById.getRecomputations(), 1);
  });
  it('should increase # of recomputations when parameters changes', () => {
    const selectLetterById = parameterizedSelectorFactory.withOptions({
      createKeyFromParams: KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS,
      compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
      compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY,
      isRootSelector: true,
    })((state, id) => state.letterById[id]);

    const firstState = {
      letterById: {
        1: 'a',
        2: 'b',
      },
    };

    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById(firstState, 2), 'b');
    assert.equal(selectLetterById.getRecomputations(), 1);
  });
});
