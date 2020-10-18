/* eslint-env mocha */
/* eslint-disable camelcase */
import chai from 'chai';
import produce from 'immer';

import { getInitialState, getSelectors } from './premade-selectors/appointmentSelectors';
import { assertCountsForParams } from './util';

const assert = chai.assert; // eslint-disable-line prefer-destructuring


describe('Overlapping dependencies', () => {
  let initialState;

  let selectRawAppointmentData;
  // let selectRawAppointmentIds;
  // let selectAppointmentById;
  let selectAllAppointments;
  let selectAllAppointmentsInOrder;
  // let selectAppointmentsForDay;
  // let selectAppointmentsForDayRange;
  // let selectAppointmentsForDayRangeInOrder;

  beforeEach(() => {
    initialState = getInitialState();

    // The selectors get recreated for each test, to reset their call counts.
    ({
      selectRawAppointmentData,
      // selectRawAppointmentIds,
      // selectAppointmentById,
      selectAllAppointments,
      selectAllAppointmentsInOrder,
      // selectAppointmentsForDay,
      // selectAppointmentsForDayRange,
      // selectAppointmentsForDayRangeInOrder,
    } = getSelectors());
  });


  it('works properly when selecting outer selector before inner', () => {
    let state = initialState;
    const allAppointmentsInOrder_1 = selectAllAppointmentsInOrder(state);
    const allAppointments_1 = selectAllAppointments(state);

    assert.equal(allAppointmentsInOrder_1[5].title, 'Break');
    assert.equal(allAppointments_1[5].title, 'Finals, day 1');
    assertCountsForParams(selectRawAppointmentData, 5, {
      invokeCount: 1,
      fullRunCount: 1,
    });
    assertCountsForParams(selectAllAppointmentsInOrder, null, {
      invokeCount: 1,
      fullRunCount: 1,
    });
    assertCountsForParams(selectAllAppointments, null, {
      invokeCount: 2,
      fullRunCount: 1,
      skippedRunCount: 1,
    });

    // A no-impact change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById = { ...state.appointmentDataById };
    });

    const allAppointmentsInOrder_2 = selectAllAppointmentsInOrder(state);
    const allAppointments_2 = selectAllAppointments(state);

    assert.equal(allAppointmentsInOrder_2[5].title, 'Break');
    assert.equal(allAppointments_2[5].title, 'Finals, day 1');
    assertCountsForParams(selectRawAppointmentData, 5, {
      invokeCount: 3,
      fullRunCount: 1,
      phantomRunCount: 1,
      skippedRunCount: 1,
    });
    assertCountsForParams(selectAllAppointmentsInOrder, null, {
      invokeCount: 2,
      fullRunCount: 1,
      skippedRunCount: 1,
    });
    assertCountsForParams(selectAllAppointments, null, {
      invokeCount: 3,
      fullRunCount: 1,
      skippedRunCount: 2,
    });

    // A second no-impact change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById[45].title = 'Break (day 2)';
    });

    const allAppointmentsInOrder_3 = selectAllAppointmentsInOrder(state);
    const allAppointments_3 = selectAllAppointments(state);

    assert.equal(allAppointmentsInOrder_3[5].title, 'Break');
    assert.equal(allAppointments_3[5].title, 'Finals, day 1');
    assertCountsForParams(selectRawAppointmentData, 5, {
      invokeCount: 6, // @FIXME: This value looks wrong: should it be 5?
      fullRunCount: 1,
      phantomRunCount: 2,
      skippedRunCount: 3,
    });
    assertCountsForParams(selectAllAppointmentsInOrder, null, {
      invokeCount: 3,
      fullRunCount: 2,
      skippedRunCount: 1,
    });
    assertCountsForParams(selectAllAppointments, null, {
      invokeCount: 6,
      fullRunCount: 2,
      skippedRunCount: 4,
    });
  });


  it('works properly when selecting inner selector before outer', () => {
    let state = initialState;
    const allAppointments_1 = selectAllAppointments(state);
    const allAppointmentsInOrder_1 = selectAllAppointmentsInOrder(state);

    assert.equal(allAppointmentsInOrder_1[5].title, 'Break');
    assert.equal(allAppointments_1[5].title, 'Finals, day 1');
    assertCountsForParams(selectRawAppointmentData, 5, {
      invokeCount: 1,
      fullRunCount: 1,
    });
    assertCountsForParams(selectAllAppointmentsInOrder, null, {
      invokeCount: 1,
      fullRunCount: 1,
    });
    assertCountsForParams(selectAllAppointments, null, {
      invokeCount: 2,
      fullRunCount: 1,
      skippedRunCount: 1,
    });

    // A no-impact change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById = { ...state.appointmentDataById };
    });

    const allAppointments_2 = selectAllAppointments(state);
    const allAppointmentsInOrder_2 = selectAllAppointmentsInOrder(state);

    assert.equal(allAppointmentsInOrder_2[5].title, 'Break');
    assert.equal(allAppointments_2[5].title, 'Finals, day 1');
    assertCountsForParams(selectRawAppointmentData, 5, {
      invokeCount: 2,
      fullRunCount: 1,
      phantomRunCount: 1,
    });
    assertCountsForParams(selectAllAppointmentsInOrder, null, {
      invokeCount: 2,
      fullRunCount: 1,
      skippedRunCount: 1,
    });
    assertCountsForParams(selectAllAppointments, null, {
      invokeCount: 3,
      fullRunCount: 1,
      skippedRunCount: 2,
    });

    // A second no-impact change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById[45].title = 'Break (day 2)';
    });

    const allAppointments_3 = selectAllAppointments(state);
    const allAppointmentsInOrder_3 = selectAllAppointmentsInOrder(state);

    assert.equal(allAppointmentsInOrder_3[5].title, 'Break');
    assert.equal(allAppointments_3[5].title, 'Finals, day 1');
    assertCountsForParams(selectRawAppointmentData, 5, {
      invokeCount: 4,
      fullRunCount: 1,
      phantomRunCount: 2,
      skippedRunCount: 1,
    });
    assertCountsForParams(selectAllAppointmentsInOrder, null, {
      invokeCount: 3,
      fullRunCount: 1,
      skippedRunCount: 2,
    });
    assertCountsForParams(selectAllAppointments, null, {
      invokeCount: 4,
      fullRunCount: 2,
      skippedRunCount: 2,
    });
  });
});
