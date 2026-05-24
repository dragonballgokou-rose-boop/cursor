import { useReducer, useEffect, useCallback } from 'react';
import { loadTrips, saveTrips } from '../utils/storage';
import { generateId } from '../utils/formatters';

function createEmptyTrip() {
  return {
    id: generateId('trip'),
    name: '新しい旅行',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stops: [
      { id: generateId('stop'), name: '', lat: null, lng: null, address: '', memo: '', order: 0 },
      { id: generateId('stop'), name: '', lat: null, lng: null, address: '', memo: '', order: 1 },
    ],
  };
}

function reducer(state, action) {
  const now = new Date().toISOString();
  switch (action.type) {
    case 'LOAD_ALL':
      return { ...state, trips: action.trips };
    case 'CREATE_TRIP': {
      const trip = createEmptyTrip();
      return {
        ...state,
        trips: [trip, ...state.trips],
        currentTripId: trip.id,
      };
    }
    case 'SELECT_TRIP':
      return { ...state, currentTripId: action.id };
    case 'DELETE_TRIP': {
      const trips = state.trips.filter(t => t.id !== action.id);
      return {
        ...state,
        trips,
        currentTripId: state.currentTripId === action.id ? null : state.currentTripId,
      };
    }
    case 'RENAME_TRIP':
      return {
        ...state,
        trips: state.trips.map(t =>
          t.id === state.currentTripId ? { ...t, name: action.name, updatedAt: now } : t
        ),
      };
    case 'ADD_STOP': {
      return {
        ...state,
        trips: state.trips.map(t => {
          if (t.id !== state.currentTripId) return t;
          const newStop = {
            id: generateId('stop'),
            name: '',
            lat: null,
            lng: null,
            address: '',
            memo: '',
            order: action.index,
          };
          const stops = [...t.stops];
          stops.splice(action.index, 0, newStop);
          return { ...t, stops: stops.map((s, i) => ({ ...s, order: i })), updatedAt: now };
        }),
      };
    }
    case 'REMOVE_STOP':
      return {
        ...state,
        trips: state.trips.map(t => {
          if (t.id !== state.currentTripId) return t;
          if (t.stops.length <= 2) return t;
          const stops = t.stops.filter(s => s.id !== action.stopId).map((s, i) => ({ ...s, order: i }));
          return { ...t, stops, updatedAt: now };
        }),
      };
    case 'UPDATE_STOP':
      return {
        ...state,
        trips: state.trips.map(t => {
          if (t.id !== state.currentTripId) return t;
          return {
            ...t,
            stops: t.stops.map(s => (s.id === action.stopId ? { ...s, ...action.data } : s)),
            updatedAt: now,
          };
        }),
      };
    case 'REORDER_STOPS': {
      return {
        ...state,
        trips: state.trips.map(t => {
          if (t.id !== state.currentTripId) return t;
          const stops = [...t.stops];
          const [moved] = stops.splice(action.fromIndex, 1);
          stops.splice(action.toIndex, 0, moved);
          return { ...t, stops: stops.map((s, i) => ({ ...s, order: i })), updatedAt: now };
        }),
      };
    }
    default:
      return state;
  }
}

export function useTrips() {
  const [state, dispatch] = useReducer(reducer, { trips: [], currentTripId: null });

  useEffect(() => {
    dispatch({ type: 'LOAD_ALL', trips: loadTrips() });
  }, []);

  useEffect(() => {
    if (state.trips.length > 0 || loadTrips().length > 0) {
      saveTrips(state.trips);
    }
  }, [state.trips]);

  const currentTrip = state.trips.find(t => t.id === state.currentTripId) || null;

  const createTrip = useCallback(() => dispatch({ type: 'CREATE_TRIP' }), []);
  const selectTrip = useCallback(id => dispatch({ type: 'SELECT_TRIP', id }), []);
  const deleteTrip = useCallback(id => dispatch({ type: 'DELETE_TRIP', id }), []);
  const renameTrip = useCallback(name => dispatch({ type: 'RENAME_TRIP', name }), []);
  const addStop = useCallback(index => dispatch({ type: 'ADD_STOP', index }), []);
  const removeStop = useCallback(stopId => dispatch({ type: 'REMOVE_STOP', stopId }), []);
  const updateStop = useCallback((stopId, data) => dispatch({ type: 'UPDATE_STOP', stopId, data }), []);
  const reorderStops = useCallback(
    (fromIndex, toIndex) => dispatch({ type: 'REORDER_STOPS', fromIndex, toIndex }),
    []
  );

  return {
    trips: state.trips,
    currentTrip,
    createTrip,
    selectTrip,
    deleteTrip,
    renameTrip,
    addStop,
    removeStop,
    updateStop,
    reorderStops,
  };
}
