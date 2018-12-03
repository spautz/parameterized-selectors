/* eslint-env mocha */
import chai from 'chai';

import {
  KEY_PRESETS,
  COMPARISON_PRESETS,
  parameterizedSelectorFactory,
} from '../src/index';

const assert = chai.assert; // eslint-disable-line prefer-destructuring

describe('parameterized selector factory', () => {
  it('should NOT increase # of full-runs when state and parameters do not change', () => {
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
    assert.equal(selectLetterById.getGlobalFullRunCount(), 1);
    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById.getGlobalFullRunCount(), 1);

    // And just for thoroughness, verify the other values too
    assert.equal(selectLetterById.getGlobalInvokeCount(), 5);
    assert.equal(selectLetterById.getGlobalSkippedRunCount(), 4);
    assert.equal(selectLetterById.getGlobalPhantomRunCount(), 0);
    assert.equal(selectLetterById.getGlobalAbortedRunCount(), 0);
  });

  it('should increase # of full-runs when state changes', () => {
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
    assert.equal(selectLetterById.getGlobalFullRunCount(), 1);
    assert.equal(selectLetterById.getGlobalPhantomRunCount(), 0);
    // State changed so the return value didn't, so these will be phantom runs
    assert.equal(selectLetterById(secondState, 1), 'a');
    assert.equal(selectLetterById.getGlobalFullRunCount(), 1);
    assert.equal(selectLetterById.getGlobalPhantomRunCount(), 1);
    assert.equal(selectLetterById(firstState, 1), 'a');
    assert.equal(selectLetterById.getGlobalFullRunCount(), 1);
    assert.equal(selectLetterById.getGlobalPhantomRunCount(), 2);

    // And just for thoroughness, verify the other values too
    assert.equal(selectLetterById.getGlobalInvokeCount(), 3);
    assert.equal(selectLetterById.getGlobalSkippedRunCount(), 0);
    assert.equal(selectLetterById.getGlobalAbortedRunCount(), 0);
  });

  it('should count # of full-runs by distinct parameters', () => {
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
    assert.equal(selectLetterById.getGlobalFullRunCount(), 2);
    assert.equal(selectLetterById.getFullRunCountForParams(1), 1);
    assert.equal(selectLetterById.getFullRunCountForParams(2), 1);

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
    assert.equal(selectLetterById.getGlobalFullRunCount(), 5);
    assert.equal(selectLetterById.getFullRunCountForParams(1), 2);
    assert.equal(selectLetterById.getFullRunCountForParams(2), 2);
    assert.equal(selectLetterById.getFullRunCountForParams(3), 1);

    // And just for thoroughness, verify the other values too
    assert.equal(selectLetterById.getGlobalInvokeCount(), 10);
    assert.equal(selectLetterById.getGlobalSkippedRunCount(), 5);
    assert.equal(selectLetterById.getGlobalPhantomRunCount(), 0);
    assert.equal(selectLetterById.getGlobalAbortedRunCount(), 0);
  });
});
