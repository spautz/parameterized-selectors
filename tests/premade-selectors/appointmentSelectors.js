/* eslint-disable prefer-arrow-callback */

import sortBy from 'lodash/sortBy';
import filter from 'lodash/filter';

import {
  COMPARISON_PRESETS,
  createParameterizedRootSelector,
  createParameterizedSelector,
} from '../../src';


const makeDateObjectForDay = dayNum => new Date(2018, 0, dayNum);

const getInitialState = () => ({
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
    40: { dayNum: 10, title: 'Alice\'s birthday' },
    41: { dayNum: 20, title: 'Bob\'s birthday' },
    42: { dayNum: 40, title: 'Chris\'s birthday' },
    43: { dayNum: 80, title: 'Alice & Bob\'s anniversary' },
    44: { dayNum: 10, title: 'Break' },
    45: { dayNum: 11, title: 'Break' },
    46: { dayNum: 12, title: 'Break' },
    47: { dayNum: 77, title: 'Vacation' },
    48: { dayNum: 71, title: 'Vacation' },
    49: { dayNum: 72, title: 'Vacation' },
  },
});


const getSelectors = () => {
  const selectRawAppointmentData = createParameterizedRootSelector(
    function _selectRawAppointmentData(state, appointmentId) {
      return state.appointmentDataById[appointmentId];
    },
    {
      performanceChecksEnabled: true,
    },
  );

  const selectRawAppointmentIds = createParameterizedRootSelector(
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
  const selectAppointmentById = createParameterizedSelector(
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

  const selectAllAppointments = createParameterizedSelector(
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

  const selectAllAppointmentsInOrder = createParameterizedSelector(
    function _selectAllAppointmentsInOrder() {
      const allAppointments = selectAllAppointments();
      return sortBy(allAppointments, 'day');
    },
    {
      performanceChecksEnabled: true,
    },
  );

  const selectAppointmentsForDay = createParameterizedSelector(
    function _selectAppointmentsForDay({ dayNum }) {
      // This naive implementation is going to walk through all appointments
      const allAppointments = selectAllAppointments();
      return filter(allAppointments, appointment => appointment.dayNum === dayNum);
    },
    {
      performanceChecksEnabled: true,
    },
  );

  const selectAppointmentsForDayRange = createParameterizedSelector(
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

  const selectAppointmentsForDayRangeInOrder = createParameterizedSelector(
    function _selectAppointmentsForDayRangeInOrder({ startDayNum, endDayNum }) {
      const appointmentsInRange = selectAppointmentsForDayRange({ startDayNum, endDayNum });
      return sortBy(appointmentsInRange, 'day');
    },
    {
      performanceChecksEnabled: true,
    },
  );

  return {
    selectRawAppointmentData,
    selectRawAppointmentIds,
    selectAppointmentById,
    selectAllAppointments,
    selectAllAppointmentsInOrder,
    selectAppointmentsForDay,
    selectAppointmentsForDayRange,
    selectAppointmentsForDayRangeInOrder,
  };
};


export {
  getInitialState,
  getSelectors,
  makeDateObjectForDay,
};
