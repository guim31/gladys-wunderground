// -----------------------------------------------------------------------------
// One Gladys device per Weather Underground station.
//
// External ids are forever: the device is `station` + the upper-case station
// id, each feature key below is frozen once published. Read-only sensors
// only: nothing here is a command.
// -----------------------------------------------------------------------------

import {
  DEVICE_FEATURE_CATEGORIES as C,
  DEVICE_FEATURE_TYPES as T,
  DEVICE_FEATURE_UNITS as U,
  DEVICE_POLL_FREQUENCIES,
} from '@gladysassistant/integration-sdk';
import { FEATURE_NAMES, pick } from './i18n.js';
import { ageMinutes } from './wu/observation.js';

export const DEVICE_TYPE = 'station';

// An observation older than this is "stale": the station stopped uploading
// (the API itself drops it after 60 minutes).
export const STALE_AFTER_MINUTES = 30;

/**
 * Feature key → definition. `value` reads the normalized observation;
 * `optional` features are left out of a station whose observation says it
 * has no such sensor (a station without UV or solar sensor sends null).
 * Bounds are display bounds (the core never clamps a state): wide enough for
 * any weather on Earth.
 */
export const FEATURES = {
  temperature: {
    category: C.TEMPERATURE_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.CELSIUS,
    min: -60,
    max: 60,
    value: (o) => o.temperature,
  },
  feels_like: {
    category: C.TEMPERATURE_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.CELSIUS,
    min: -80,
    max: 80,
    value: (o) => o.feelsLike,
  },
  dew_point: {
    category: C.TEMPERATURE_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.CELSIUS,
    min: -60,
    max: 60,
    value: (o) => o.dewPoint,
  },
  humidity: {
    category: C.HUMIDITY_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.PERCENT,
    min: 0,
    max: 100,
    value: (o) => o.humidity,
  },
  pressure: {
    category: C.PRESSURE_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.HECTO_PASCAL,
    min: 900,
    max: 1100,
    value: (o) => o.pressure,
  },
  wind_speed: {
    category: C.SPEED_SENSOR,
    type: T.SPEED_SENSOR.DECIMAL,
    unit: U.KILOMETER_PER_HOUR,
    min: 0,
    max: 300,
    optional: (o) => o.windSpeed === null && o.windDirection === null,
    value: (o) => o.windSpeed,
  },
  wind_gust: {
    category: C.SPEED_SENSOR,
    type: T.SPEED_SENSOR.DECIMAL,
    unit: U.KILOMETER_PER_HOUR,
    min: 0,
    max: 300,
    optional: (o) => o.windSpeed === null && o.windDirection === null,
    value: (o) => o.windGust,
  },
  wind_direction: {
    category: C.ANGLE_SENSOR,
    type: T.SENSOR.INTEGER,
    unit: U.DEGREE,
    min: 0,
    max: 360,
    optional: (o) => o.windSpeed === null && o.windDirection === null,
    value: (o) => o.windDirection,
  },
  rain_rate: {
    category: C.PRECIPITATION_SENSOR,
    type: T.PRECIPITATION_SENSOR.DECIMAL,
    unit: U.MILLIMETER_PER_HOUR,
    min: 0,
    max: 500,
    optional: (o) => o.rainRate === null && o.rainToday === null,
    value: (o) => o.rainRate,
  },
  // The total since local midnight. The core's precipitation units are
  // mm/h and mm/day (Netatmo's 24 h total uses mm/day too).
  rain_today: {
    category: C.PRECIPITATION_SENSOR,
    type: T.PRECIPITATION_SENSOR.DECIMAL,
    unit: U.MILLIMETER_PER_DAY,
    min: 0,
    max: 1000,
    optional: (o) => o.rainRate === null && o.rainToday === null,
    value: (o) => o.rainToday,
  },
  uv_index: {
    category: C.UV_SENSOR,
    type: T.UV_SENSOR.INTEGER,
    unit: U.UV_INDEX,
    min: 0,
    max: 20,
    optional: (o) => o.uvIndex === null,
    value: (o) => o.uvIndex,
  },
  // Gladys has no W/m²: the light sensor gets lux (see wu/observation.js).
  illuminance: {
    category: C.LIGHT_SENSOR,
    type: T.SENSOR.DECIMAL,
    unit: U.LUX,
    min: 0,
    max: 200000,
    optional: (o) => o.solarRadiation === null,
    value: (o) => o.illuminance,
  },
  // Minutes since the station's last observation: grows while the station is
  // silent, so a scene can watch it ("above 30 min").
  observation_age: {
    category: C.DURATION,
    type: T.DURATION.INTEGER,
    unit: U.MINUTES,
    min: 0,
    max: 1440,
    value: (o, now) => ageMinutes(o, now),
  },
};

/** The external ids of a station (device and features). */
export function stationIds(gladys, station) {
  return gladys.externalIds(DEVICE_TYPE, station.platformId);
}

/** The keys of the features a station gets, from its observation (all without one). */
export function featureKeys(observation) {
  return Object.entries(FEATURES)
    .filter(([, def]) => !(observation && def.optional?.(observation)))
    .map(([key]) => key);
}

/**
 * The discovery payload of one station.
 * @param {object} gladys
 * @param {{ id: string, platformId: string }} station
 * @param {object | null} observation the normalized observation, if any
 * @param {string} language feature names
 */
export function buildStationDevice(gladys, station, observation, language) {
  const ids = stationIds(gladys, station);
  const names = pick(FEATURE_NAMES, language);
  const where = observation?.neighborhood;
  return {
    name: where ? `${where} (${station.platformId})` : `Weather Underground ${station.platformId}`,
    external_id: ids.device,
    model: 'Weather Underground PWS',
    // Gladys calls onPoll only with both fields; the container polls by itself
    // anyway (src/poller.js, GladysAssistant/Gladys#3198), this is the fallback.
    should_poll: true,
    poll_frequency: DEVICE_POLL_FREQUENCIES.EVERY_MINUTES,
    features: featureKeys(observation).map((key) => {
      const def = FEATURES[key];
      return {
        name: names[key],
        external_id: ids.feature(key),
        category: def.category,
        type: def.type,
        unit: def.unit,
        min: def.min,
        max: def.max,
        read_only: true,
        has_feedback: false,
        keep_history: true,
      };
    }),
  };
}

/**
 * The states of one station: every feature of the device as created in Gladys
 * (`createdFeatures`, external ids) whose value is known.
 * @param {object} gladys
 * @param {{ platformId: string }} station
 * @param {object} observation normalized
 * @param {number} now
 * @param {Set<string>} [createdFeatures] when given, only these features
 */
export function stationStates(gladys, station, observation, now, createdFeatures) {
  const ids = stationIds(gladys, station);
  const states = [];
  for (const [key, def] of Object.entries(FEATURES)) {
    const externalId = ids.feature(key);
    if (createdFeatures && !createdFeatures.has(externalId)) {
      continue;
    }
    const value = def.value(observation, now);
    if (value === null || value === undefined) {
      continue;
    }
    states.push({ device_feature_external_id: externalId, state: value });
  }
  return states;
}

/** The observation is older than STALE_AFTER_MINUTES (or has no time). */
export function isStale(observation, now) {
  const age = ageMinutes(observation, now);
  return age === null || age > STALE_AFTER_MINUTES;
}
