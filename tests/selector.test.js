/* eslint-env mocha */
import chai from 'chai';

import {
  KEY_PRESETS,
  COMPARISON_PRESETS,
  parameterizedSelectorFactory,
} from '../src/index';

const assert = chai.assert; // eslint-disable-line prefer-destructuring

describe('parameterized selector factory', () => {
  it('should NOT increase # of recomputations when state and parameters don\'t change', () => {
    const selectLetterById = parameterizedSelectorFactory.withOptions({
      createKeyFromParams: KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS,
      compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
      compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY,
      isRootSelector: true,
      performanceChecksEnabled: true,
    })((state, id) => state.letterById[id]);

    const firstState = {
      letterById: {
        1: 'a',
      },
    };

    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById.getTotalRecomputations(), 0);
  });
  it('should increase # of recomputations when state changes', () => {
    const selectLetterById = parameterizedSelectorFactory.withOptions({
      createKeyFromParams: KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS,
      compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
      compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY,
      isRootSelector: true,
      performanceChecksEnabled: true,
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
    assert.equal(selectLetterById.getTotalRecomputations(), 1);
  });
  it('should count # of recomputations by distinct parameters', () => {
    const selectLetterById = parameterizedSelectorFactory.withOptions({
      createKeyFromParams: KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS,
      compareIncomingStates: COMPARISON_PRESETS.SAME_REFERENCE,
      compareSelectorResults: COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY,
      isRootSelector: true,
      performanceChecksEnabled: true,
    })((state, id) => state.letterById[id]);

    const firstState = {
      letterById: {
        1: 'a',
        2: 'b',
      },
    };

    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById(firstState, 2), 'b');
    assert.equal(selectLetterById(firstState, 2), 'b');
    assert.equal(selectLetterById.getTotalRecomputations(), 0);
    assert.equal(selectLetterById.getRecomputationsForParams(1), 0);
    assert.equal(selectLetterById.getRecomputationsForParams(2), 0);

    const secondState = {
      letterById: {
        1: 'aa',
        2: 'bb',
        3: 'cc',
      },
    };

    assert.equal(selectLetterById(secondState, 1), 'aa');
    assert.equal(selectLetterById(secondState, 1), 'aa');
    assert.equal(selectLetterById(secondState, 2), 'bb');
    assert.equal(selectLetterById(secondState, 2), 'bb');
    assert.equal(selectLetterById(secondState, 3), 'cc');
    assert.equal(selectLetterById(secondState, 3), 'cc');
    assert.equal(selectLetterById.getTotalRecomputations(), 2);
    assert.equal(selectLetterById.getRecomputationsForParams(1), 1);
    assert.equal(selectLetterById.getRecomputationsForParams(2), 1);
    assert.equal(selectLetterById.getRecomputationsForParams(3), 0);
  });
});
