/* eslint-env mocha */
import chai from 'chai';
import { getInitialState, getSelectors } from './premade-selectors/appointmentSelectors';

const assert = chai.assert; // eslint-disable-line prefer-destructuring


// This is basically an implementation of assert.deepInclude but with better error messages.
// @TODO: Is this useful enough to promote this to its own file, and possibly export?
const assertCountsForParams = (selectorFn, params, expectedCounts) => {
  const actualCounts = selectorFn.getAllCountsForParams(params);
  const verboseErrorInfo = `Checking counts for ${selectorFn.displayName}(${selectorFn.createKeyFromParams(params)}):
      Expected: ${JSON.stringify(expectedCounts)}
      Actual: ${JSON.stringify(actualCounts)}\n`;

  Object.keys(expectedCounts).forEach(function (key) {
    if (!Object.hasOwnProperty.call(actualCounts, key)) {
      assert.fail(`${verboseErrorInfo}Invalid count type for assertCountsForParams: "${key}" not found`);
    }
    assert.equal(actualCounts[key], expectedCounts[key], `${verboseErrorInfo} Count type "${key}" should match`);
  });
};


describe('Overlapping dependencies', () => {
  const initialState = getInitialState();

  let selectRawAppointmentData;
  let selectRawAppointmentIds;
  let selectAppointmentById;
  let selectAllAppointments;
  let selectAllAppointmentsInOrder;
  let selectAppointmentsForDay;
  let selectAppointmentsForDayRange;
  let selectAppointmentsForDayRangeInOrder;

  beforeEach(() => {
    // The selectors get recreated for each test, to reset their call counts.
    ({
      selectRawAppointmentData,
      selectRawAppointmentIds,
      selectAppointmentById,
      selectAllAppointments,
      selectAllAppointmentsInOrder,
      selectAppointmentsForDay,
      selectAppointmentsForDayRange,
      selectAppointmentsForDayRangeInOrder,
    } = getSelectors());
  });


});
