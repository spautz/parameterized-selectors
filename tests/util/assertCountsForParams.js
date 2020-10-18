/* eslint-env mocha */
import chai from 'chai';

const { assert } = chai;


/**
 * This is basically an implementation of assert.deepInclude but with better error messages.
 *
 * @param {Function} selectorFn
 * @param {Object|String|Number} params
 * @param {Object} expectedCounts
 */
const assertCountsForParams = (selectorFn, params, expectedCounts) => {
  const actualCounts = selectorFn.getAllCountsForParams(params);
  const verboseErrorInfo = `Checking counts for ${selectorFn.displayName}(${selectorFn.createKeyFromParams(params)}):
      Expected: ${JSON.stringify(expectedCounts)}
      Actual: ${JSON.stringify(actualCounts)}\n`;

  Object.keys(expectedCounts).forEach((key) => {
    if (!Object.hasOwnProperty.call(actualCounts, key)) {
      assert.fail(`${verboseErrorInfo}Invalid count type for assertCountsForParams: "${key}" not found`);
    }
    assert.equal(actualCounts[key], expectedCounts[key], `${verboseErrorInfo} Count type "${key}" should match`);
  });
};

export default assertCountsForParams;
