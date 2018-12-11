/* eslint-env mocha */
import chai from 'chai';
import produce from 'immer';

import { getInitialState, getSelectors } from './appointmentSelectors';
import { assertCountsForParams } from '../util';

const { assert } = chai;


describe('Premade appointment selectors', () => {
  let initialState;

  let selectRawAppointmentData;
  let selectRawAppointmentIds;
  let selectAppointmentById;
  let selectAllAppointments;
  let selectAllAppointmentsInOrder;
  let selectAppointmentsForDay;
  let selectAppointmentsForDayRange;
  let selectAppointmentsForDayRangeInOrder;

  beforeEach(() => {
    initialState = getInitialState();

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


  it('selectRawAppointmentData', () => {
    let state = initialState;
    const appointment1_1 = selectRawAppointmentData(state, 1);
    const appointment2_1 = selectRawAppointmentData(state, 2);

    assert.equal(appointment1_1.title, 'Orientation');
    assert.equal(tests/premade-selectors/appointmentSelectors.test.js:46.title, 'Classes begin');
    assertCountsForParams(selectRawAppointmentData, 1, {
      invokeCount: 1,
      fullRunCount: 1,
    });

    // A no-impact change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById = state.appointmentDataById;
    });

    const appointment1_2 = selectRawAppointmentData(state, 1);
    const appointment2_2 = selectRawAppointmentData(state, 2);

    assert.equal(appointment1_2, appointment1_1);
    assert.equal(appointment2_2, appointment2_1);
    assertCountsForParams(selectRawAppointmentData, 1, {
      invokeCount: 2,
      fullRunCount: 1,
      phantomRunCount: 1,
    });

    // An impactful change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById[1].title = 'Welcome';
      // eslint-disable-next-line no-self-assign
      newState.appointmentDataById[2].title = state.appointmentDataById[2].title;
    });

    const appointment1_3 = selectRawAppointmentData(state, 1);
    const appointment2_3 = selectRawAppointmentData(state, 2);

    assert.equal(appointment1_3.title, 'Welcome');
    assert.notEqual(appointment1_3, appointment1_1);
    assert.equal(appointment2_3.title, 'Classes begin');
    assert.equal(appointment2_3, appointment2_1);
    assertCountsForParams(selectRawAppointmentData, 1, {
      invokeCount: 3,
      fullRunCount: 2,
      phantomRunCount: 1,
    });
    assertCountsForParams(selectRawAppointmentData, 2, {
      invokeCount: 3,
      fullRunCount: 1,
      phantomRunCount: 2,
    });
  });


  it('selectRawAppointmentIds', () => {
    let state = initialState;
    let allAppointmentIds = selectRawAppointmentIds();

    assert.equal(allAppointmentIds[10], 21);
    assert.equal(allAppointmentIds[11], 22);
    assertCountsForParams(selectRawAppointmentIds, null, {
      invokeCount: 1,
      fullRunCount: 1,
    });

    // An impactful change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById[50] = {
        dayNum: 50,
        title: 'New event!',
      };
    });

    allAppointmentIds = selectRawAppointmentIds();

    assert.equal(allAppointmentIds[10], 21);
    assert.equal(allAppointmentIds[11], 22);
    assertCountsForParams(selectRawAppointmentIds, null, {
      invokeCount: 2,
      fullRunCount: 2,
    });

    // A no-impact change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById = state.appointmentDataById;
    });

    allAppointmentIds = selectRawAppointmentIds();

    assert.equal(allAppointmentIds[10], 21);
    assert.equal(allAppointmentIds[11], 22);
    assertCountsForParams(selectRawAppointmentIds, null, {
      invokeCount: 3,
      fullRunCount: 2,
      phantomRunCount: 1,
    });
  });


  it('selects appointment models by ID', () => {
    let state = initialState;
    const appointment1 = selectAppointmentById(initialState, { appointmentId: 1 });
    const appointment2 = selectAppointmentById(initialState, { appointmentId: 2 });

    assert.equal(appointment1.title, 'Orientation');
    assert.equal(appointment2.title, 'Classes begin');

    assertCountsForParams(selectAppointmentById, { appointmentId: 1 }, {
      invokeCount: 1,
      fullRunCount: 1,
    });

    // A no-impact change
    state = produce(state, (newState) => {
      /* eslint-disable no-param-reassign */
      newState.appointmentDataById = state.appointmentDataById;
    });

    assert.equal(appointment1, selectAppointmentById(state, { appointmentId: 1 }));
    assert.equal(appointment2, selectAppointmentById(state, { appointmentId: 2 }));

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
  });

  it('should return all appointment models', () => {
    const appointmentList = selectAllAppointments(initialState);

  });
});
