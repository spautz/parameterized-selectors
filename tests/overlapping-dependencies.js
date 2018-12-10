/* eslint-env mocha */
/* eslint-disable prefer-arrow-callback */
import chai from 'chai';
import filter from 'lodash/filter';

import {
  COMPARISON_PRESETS,
  createParameterizedRootSelector,
  createParameterizedSelector,
} from '../src/index';

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
  const initialState = {
    appointmentDataById: {
      0: { dayNum: 0, title: 'Start of semester' },
      1: { dayNum: 1, title: 'Orientation' },
      2: { dayNum: 5, title: 'Classes begin' },
      3: { dayNum: 50, title: 'Midterms, day 1' },
      4: { dayNum: 51, title: 'Midterms, day 2' },
      5: { dayNum: 95, title: 'Finals, day 1' },
      6: { dayNum: 96, title: 'Finals, day 2' },
      7: { dayNum: 97, title: 'Finals, day 3' },
      8: { dayNum: 99, title: 'End of semester' },
      20: { dayNum: 10, title: 'Day 10' },
      21: { dayNum: 20, title: 'Day 20' },
      22: { dayNum: 30, title: 'Day 30' },
      23: { dayNum: 40, title: 'Day 40' },
      24: { dayNum: 50, title: 'Day 50' },
      25: { dayNum: 60, title: 'Day 60' },
      26: { dayNum: 70, title: 'Day 70' },
      27: { dayNum: 80, title: 'Day 80' },
      28: { dayNum: 90, title: 'Day 90' },
      40: { dayNum: 15, title: 'Alice\'s birthday' },
      41: { dayNum: 25, title: 'Bob\'s birthday' },
      42: { dayNum: 41, title: 'Chris\'s birthday' },
      43: { dayNum: 89, title: 'Alice & Bob\'s anniversary' },
      44: { dayNum: 11, title: 'Break' },
      45: { dayNum: 12, title: 'Break' },
      46: { dayNum: 13, title: 'Break' },
      47: { dayNum: 75, title: 'Vacation' },
      48: { dayNum: 76, title: 'Vacation' },
      49: { dayNum: 77, title: 'Vacation' },
    },
  };
  const makeDateObjectForDay = dayNum => new Date(2018, 0, dayNum);

  let selectRawAppointmentData;
  let selectRawAppointmentIds;
  let selectAppointmentById;
  let selectAllAppointments;
  let selectAppointmentsForDay;
  let selectAppointmentsForDayRange;

  beforeEach(() => {
    // The selectors get recreated for each test, to reset their call counts.
    selectRawAppointmentData = createParameterizedRootSelector(
      function _selectRawAppointmentData(state, appointmentId) {
        return state.appointmentDataById[appointmentId];
      },
      {
        performanceChecksEnabled: true,
      },
    );
    selectRawAppointmentIds = createParameterizedRootSelector(
      function _selectRawAppointmentIds(state) {
        return Object.keys(state.appointmentDataById);
      },
      {
        compareSelectorResults: COMPARISON_PRESETS.SHALLOW_EQUAL,
        performanceChecksEnabled: true,
      },
    );

    // This extra layer represents a transformation or conversion from serializable Redux data into something
    // with rich objects, e.g. if you're using a date library.
    selectAppointmentById = createParameterizedSelector(
      function _selectAppointmentById({ appointmentId }) {
        const rawAppointmentData = selectRawAppointmentData(appointmentId);
        return {
          ...rawAppointmentData,
          dateObject: makeDateObjectForDay(rawAppointmentData.dayNum),
        };
      },
      {
        performanceChecksEnabled: true,
      },
    );

    selectAllAppointments = createParameterizedSelector(
      function _selectAllAppointments() {
        const rawAppointmentIds = selectRawAppointmentIds();
        return rawAppointmentIds.map(
          appointmentId => selectAppointmentById({ appointmentId }),
        );
      },
      {
        performanceChecksEnabled: true,
      },
    );

    selectAppointmentsForDay = createParameterizedSelector(
      function _selectAppointmentsForDay({ dayNum }) {
        // This naive implementation is going to walk through all appointments
        const allAppointments = selectAllAppointments();
        return filter(allAppointments, appointment => appointment.dayNum === dayNum);
      },
      {
        performanceChecksEnabled: true,
      },
    );
    selectAppointmentsForDayRange = createParameterizedSelector(
      function _selectAppointmentsForDay({ startDayNum, endDayNum }) {
        // This naive implementation is going to walk through all appointments
        const allAppointments = selectAllAppointments();
        return filter(
          allAppointments,
          appointment => appointment.dayNum >= startDayNum && appointment.dayNum <= endDayNum,
        );
      },
      {
        performanceChecksEnabled: true,
      },
    );
  });

  // First, some tests to ensure the selectors work as expected in general.

  it('should return appointment models by ID', () => {
    const appointment1 = selectAppointmentById(initialState, { appointmentId: 1 });
    const appointment2 = selectAppointmentById(initialState, { appointmentId: 2 });

    assert.equal(appointment1.title, 'Orientation');
    assert.equal(appointment2.title, 'Classes begin');

    // No changes after a no-change state change
    const newState = { ...initialState };
    assert.equal(appointment1, selectAppointmentById(newState, { appointmentId: 1 }));
    assert.equal(appointment2, selectAppointmentById(newState, { appointmentId: 2 }));

    assertCountsForParams(selectRawAppointmentData, 1, {
      invokeCount: 2,
      fullRunCount: 1,
      phantomRunCount: 1,
    });
    assertCountsForParams(selectAppointmentById, { appointmentId: 1 }, {
      invokeCount: 2,
      fullRunCount: 1,
      skippedRunCount: 1,
    });

    assertCountsForParams(selectRawAppointmentData, 2, {
      invokeCount: 2,
      fullRunCount: 1,
      phantomRunCount: 1,
    });
    assertCountsForParams(selectAppointmentById, { appointmentId: 2 }, {
      invokeCount: 2,
      fullRunCount: 1,
      skippedRunCount: 1,
    });
  });
});
