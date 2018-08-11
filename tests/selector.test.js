import chai from 'chai';

import {
  KEY_PRESETS,
  COMPARISON_PRESETS,
  parameterizedSelectorFactory,
  createParameterizedRootSelector,
  createParameterizedSelector,
} from '../src/index';

const assert = chai.assert;

describe('parameterized selector factory', () => {
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
