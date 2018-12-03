/* eslint-env mocha */
import chai from 'chai';

import {
  COMPARISON_PRESETS,
  KEY_PRESETS,
} from '../src/helpers';

const assert = chai.assert; // eslint-disable-line prefer-destructuring

describe('COMPARISON_PRESETS', () => {
  describe('SAME_REFERENCE', () => {
    it('Should fail when given different values', () => {
      const varA = 'abc';
      const varB = 'def';
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE(varA, varB), false);
    });
    it('Should fail when given different object references', () => {
      const varA = { abc: 123 };
      const varB = { abc: 123 };
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE(varA, varB), false);
    });
    it('Should pass when the reference does not change', () => {
      const varA = { abc: 123 };
      const varB = varA;
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE(varA, varB), true);
    });
    it('Should pass when the values are strictly equivalent', () => {
      const varA = 'abc';
      const varB = 'abc';
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE(varA, varB), true);
    });
  });

  describe('SAME_REFERENCE_OR_EMPTY', () => {
    // These tests are the same as SAME_REFERENCE
    it('Should fail when given different values', () => {
      const varA = 'abc';
      const varB = 'def';
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY(varA, varB), false);
    });
    it('Should fail when given different object references', () => {
      const varA = { abc: 123 };
      const varB = { abc: 123 };
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY(varA, varB), false);
    });
    it('Should pass when the reference does not change', () => {
      const varA = { abc: 123 };
      const varB = varA;
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY(varA, varB), true);
    });
    it('Should pass when the values are strictly equivalent', () => {
      const varA = 'abc';
      const varB = 'abc';
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY(varA, varB), true);
    });

    // These tests are new for SAME_REFERENCE_OR_EMPTY
    it('Should pass when the values are distinct empty arrays', () => {
      const varA = [];
      const varB = [];
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY(varA, varB), true);
    });
    it('Should pass when the values are distinct empty objects', () => {
      const varA = {};
      const varB = {};
      assert.equal(COMPARISON_PRESETS.SAME_REFERENCE_OR_EMPTY(varA, varB), true);
    });
  });

  describe('SHALLOW_EQUAL', () => {
    // These tests are the same as SAME_REFERENCE_OR_EMPTY
    it('Should fail when given different values', () => {
      const varA = 'abc';
      const varB = 'def';
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), false);
    });
    it('Should pass when the reference does not change', () => {
      const varA = { abc: 123 };
      const varB = varA;
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), true);
    });
    it('Should pass when the values are strictly equivalent', () => {
      const varA = 'abc';
      const varB = 'abc';
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), true);
    });
    it('Should pass when the values are distinct empty arrays', () => {
      const varA = [];
      const varB = [];
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), true);
    });
    it('Should pass when the values are distinct empty objects', () => {
      const varA = {};
      const varB = {};
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), true);
    });

    // These tests are new for SHALLOW_EQUAL
    it('Should pass when given different object references with the same shape', () => {
      const varA = { abc: 123 };
      const varB = { abc: 123 };
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), true);
    });
    it('Should pass when given different arrays holding the same data', () => {
      const varA = [1, 2, 3];
      const varB = [1, 2, 3];
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), true);
    });
    it('Should fail when given different arrays holding different data', () => {
      const varA = [{ abc: 123 }, { def: 456 }];
      const varB = [{ abc: 123 }, { def: 456 }];
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), false);
    });
    it('Should pass when given different arrays holding the same objects', () => {
      const varA = [{ abc: 123 }, { def: 456 }];
      const varB = [...varA];
      assert.equal(COMPARISON_PRESETS.SHALLOW_EQUAL(varA, varB), true);
    });
  });

  describe('JSON_STRING', () => {
    // These tests are the same as SHALLOW_EQUAL
    it('Should fail when given different values', () => {
      const varA = 'abc';
      const varB = 'def';
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), false);
    });
    it('Should pass when the reference does not change', () => {
      const varA = { abc: 123 };
      const varB = varA;
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), true);
    });
    it('Should pass when the values are strictly equivalent', () => {
      const varA = 'abc';
      const varB = 'abc';
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), true);
    });
    it('Should pass when the values are distinct empty arrays', () => {
      const varA = [];
      const varB = [];
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), true);
    });
    it('Should pass when the values are distinct empty objects', () => {
      const varA = {};
      const varB = {};
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), true);
    });
    it('Should pass when given different object references with the same shape', () => {
      const varA = { abc: 123 };
      const varB = { abc: 123 };
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), true);
    });
    it('Should pass when given different arrays holding the same data', () => {
      const varA = [1, 2, 3];
      const varB = [1, 2, 3];
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), true);
    });
    it('Should pass when given different arrays holding the same objects', () => {
      const varA = [{ abc: 123 }, { def: 456 }];
      const varB = [...varA];
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), true);
    });

    // These tests are new for JSON_STRING
    it('Should pass when given similar-looking arrays holding different objects', () => {
      const varA = [{ abc: 123 }, { def: 456 }];
      const varB = [{ abc: 123 }, { def: 456 }];
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), true);
    });
    it('Should fail when given arrays holding different-looking data', () => {
      const varA = [{ abc: 123 }, { def: 456 }];
      const varB = [{ abc: 123 }, { def: 789 }];
      assert.equal(COMPARISON_PRESETS.JSON_STRING(varA, varB), false);
    });
  });

  describe('RUN_EVERY_TIME', () => {
    it('Should fail even when given equivalent values', () => {
      const varA = 'abc';
      const varB = 'abc';
      assert.equal(COMPARISON_PRESETS.RUN_EVERY_TIME(varA, varB), false);
    });
    it('Should fail even when given equal references', () => {
      const varA = { abc: 123 };
      const varB = varA;
      assert.equal(COMPARISON_PRESETS.RUN_EVERY_TIME(varA, varB), false);
    });
  });

  describe('RUN_ONLY_ONCE', () => {
    it('Should pass even when given different values', () => {
      const varA = 'abc';
      const varB = 'def';
      assert.equal(COMPARISON_PRESETS.RUN_ONLY_ONCE(varA, varB), true);
    });
    it('Should pass even when given equivalent values', () => {
      const varA = 'abc';
      const varB = 'abc';
      assert.equal(COMPARISON_PRESETS.RUN_ONLY_ONCE(varA, varB), true);
    });
    it('Should pass even when given equal references', () => {
      const varA = { abc: 123 };
      const varB = varA;
      assert.equal(COMPARISON_PRESETS.RUN_ONLY_ONCE(varA, varB), true);
    });
    it('Should pass even when given different objects', () => {
      const varA = { abc: 123 };
      const varB = { def: 456 };
      assert.equal(COMPARISON_PRESETS.RUN_ONLY_ONCE(varA, varB), true);
    });
  });
});

describe('KEY_PRESETS', () => {
  describe('JSON_STRING', () => {
    // These tests are migrated from COMPARISON_PRESET.JSON_STRING's
    it('Should fail when given different values', () => {
      const keyA = KEY_PRESETS.JSON_STRING('abc');
      const keyB = KEY_PRESETS.JSON_STRING('def');
      assert.notEqual(keyA, keyB);
    });
    it('Should pass when the values are equal', () => {
      const keyA = KEY_PRESETS.JSON_STRING('abc');
      const keyB = KEY_PRESETS.JSON_STRING('abc');
      assert.equal(keyA, keyB);
    });
    it('Should pass when the values are distinct empty arrays', () => {
      const keyA = KEY_PRESETS.JSON_STRING([]);
      const keyB = KEY_PRESETS.JSON_STRING([]);
      assert.equal(keyA, keyB);
    });
    it('Should pass when the values are distinct empty objects', () => {
      const keyA = KEY_PRESETS.JSON_STRING({});
      const keyB = KEY_PRESETS.JSON_STRING({});
      assert.equal(keyA, keyB);
    });
    it('Should pass when given different object references with the same shape', () => {
      const keyA = KEY_PRESETS.JSON_STRING({ abc: 123 });
      const keyB = KEY_PRESETS.JSON_STRING({ abc: 123 });
      assert.equal(keyA, keyB);
    });
    it('Should pass when given different arrays holding the same data', () => {
      const keyA = KEY_PRESETS.JSON_STRING([1, 2, 3]);
      const keyB = KEY_PRESETS.JSON_STRING([1, 2, 3]);
      assert.equal(keyA, keyB);
    });
    it('Should pass when given similar-looking arrays holding different objects', () => {
      const keyA = KEY_PRESETS.JSON_STRING([{ abc: 123 }, { def: 456 }]);
      const keyB = KEY_PRESETS.JSON_STRING([{ abc: 123 }, { def: 456 }]);
      assert.equal(keyA, keyB);
    });
    it('Should fail when given arrays holding different-looking data', () => {
      const keyA = KEY_PRESETS.JSON_STRING([{ abc: 123 }, { def: 456 }]);
      const keyB = KEY_PRESETS.JSON_STRING([{ abc: 123 }, { def: 789 }]);
      assert.notEqual(keyA, keyB);
    });

    // These tests are now for KEY_PRESETS
    it('Should fail when key order does not match', () => {
      const keyA = KEY_PRESETS.JSON_STRING({ abc: 123, def: 456 });
      const keyB = KEY_PRESETS.JSON_STRING({ def: 456, abc: 123 });
      assert.notEqual(keyA, keyB);
    });
    it('Should fail when array order does not match', () => {
      const keyA = KEY_PRESETS.JSON_STRING([{ abc: 123 }, { def: 456 }]);
      const keyB = KEY_PRESETS.JSON_STRING([{ def: 789 }, { abc: 123 }]);
      assert.notEqual(keyA, keyB);
    });
  });

  describe('JSON_STRING_WITH_STABLE_KEYS', () => {
    // These tests are the same as JSON_STRING_WITH_STABLE_KEYS, just with the next-to-last flipped
    it('Should fail when given different values', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS('abc');
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS('def');
      assert.notEqual(keyA, keyB);
    });
    it('Should pass when the values are equal', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS('abc');
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS('abc');
      assert.equal(keyA, keyB);
    });
    it('Should pass when the values are distinct empty arrays', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([]);
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([]);
      assert.equal(keyA, keyB);
    });
    it('Should pass when the values are distinct empty objects', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({});
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({});
      assert.equal(keyA, keyB);
    });
    it('Should pass when given different object references with the same shape', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({ abc: 123 });
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({ abc: 123 });
      assert.equal(keyA, keyB);
    });
    it('Should pass when given different arrays holding the same data', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([1, 2, 3]);
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([1, 2, 3]);
      assert.equal(keyA, keyB);
    });
    it('Should pass when given similar-looking arrays holding different objects', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([{ abc: 123 }, { def: 456 }]);
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([{ abc: 123 }, { def: 456 }]);
      assert.equal(keyA, keyB);
    });
    it('Should fail when given arrays holding different-looking data', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([{ abc: 123 }, { def: 456 }]);
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([{ abc: 123 }, { def: 789 }]);
      assert.notEqual(keyA, keyB);
    });
    it('Should fail when array order does not match', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([{ abc: 123 }, { def: 456 }]);
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS([{ def: 789 }, { abc: 123 }]);
      assert.notEqual(keyA, keyB);
    });

    // These tests are now for KEY_PRESETS
    it('Should pass when key order does not match', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({ abc: 123, def: 456 });
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({ def: 456, abc: 123 });
      assert.equal(keyA, keyB);
    });
    it('Should fail when keys are added', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({ abc: 123, def: 456 });
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({ abc: 123, def: 456, ghi: 789 });
      assert.notEqual(keyA, keyB);
    });
    it('Should fail when keys are removed', () => {
      const keyA = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({ abc: 123, def: 456 });
      const keyB = KEY_PRESETS.JSON_STRING_WITH_STABLE_KEYS({ abc: 123 });
      assert.notEqual(keyA, keyB);
    });
  });
});
