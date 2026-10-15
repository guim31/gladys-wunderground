// -----------------------------------------------------------------------------
// The station device: its features, their frozen keys, the states.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { buildStationDevice, featureKeys, isStale, stationStates } from '../src/station.js';
import { parseObservation } from '../src/wu/observation.js';
import { NOW, observation } from './helpers/world.js';

const gladys = createFakeGladys();
const station = { id: 'iGladys42', platformId: 'IGLADYS42' };
const full = parseObservation(observation('current-full.json'));
const minimal = parseObservation(observation('current-minimal.json'));

// External ids are forever: this list only grows.
const ALL_KEYS = [
  'temperature',
  'feels_like',
  'dew_point',
  'humidity',
  'pressure',
  'wind_speed',
  'wind_gust',
  'wind_direction',
  'rain_rate',
  'rain_today',
  'uv_index',
  'illuminance',
  'observation_age',
];

test('the feature keys are frozen', () => {
  assert.deepEqual(featureKeys(full), ALL_KEYS);
  assert.deepEqual(featureKeys(null), ALL_KEYS, 'no observation yet: every feature');
});

test('a station without some sensors gets no feature for them', () => {
  assert.deepEqual(featureKeys(minimal), [
    'temperature',
    'feels_like',
    'dew_point',
    'humidity',
    'pressure',
    'observation_age',
  ]);
});

test('the device: stable external id from the upper-case id, neighborhood in the name', () => {
  const device = buildStationDevice(gladys, station, full, 'fr');
  assert.equal(device.external_id, 'ext:test-integration:station:IGLADYS42');
  assert.equal(device.name, 'Les Chartreux (IGLADYS42)');
  assert.equal(device.should_poll, true);
  assert.equal(device.poll_frequency, 60000);
  const temperature = device.features.find((f) => f.external_id.endsWith(':temperature'));
  assert.deepEqual(temperature, {
    name: 'Température',
    external_id: 'ext:test-integration:station:IGLADYS42:temperature',
    category: 'temperature-sensor',
    type: 'decimal',
    unit: 'celsius',
    min: -60,
    max: 60,
    read_only: true,
    has_feedback: false,
    keep_history: true,
  });
  for (const feature of device.features) {
    assert.equal(feature.read_only, true, `${feature.name}: read-only, nothing to command`);
  }
  assert.equal(
    buildStationDevice(gladys, station, null, 'en').name,
    'Weather Underground IGLADYS42',
  );
});

test('feature names follow the configured language', () => {
  const names = (language) =>
    buildStationDevice(gladys, station, full, language).features.map((f) => f.name);
  assert.equal(names('en')[0], 'Temperature');
  assert.equal(names('de')[6], 'Windböen');
  assert.equal(names('es')[12], 'Antigüedad de la observación');
});

test('the states: every known value, the age in minutes, nothing for a null', () => {
  const states = Object.fromEntries(
    stationStates(gladys, station, full, NOW).map((s) => [
      s.device_feature_external_id.split(':').pop(),
      s.state,
    ]),
  );
  assert.deepEqual(states, {
    temperature: 17.4,
    feels_like: 17.4,
    dew_point: 10.3,
    humidity: 63,
    pressure: 1016.93,
    wind_speed: 11.2,
    wind_gust: 19.8,
    wind_direction: 247,
    rain_rate: 0,
    rain_today: 2.4,
    uv_index: 3,
    illuminance: 52276,
    observation_age: 3,
  });
  const winter = parseObservation(observation('current-winter.json'));
  const keys = stationStates(gladys, station, winter, NOW).map((s) =>
    s.device_feature_external_id.split(':').pop(),
  );
  assert.ok(!keys.includes('wind_gust'), 'no gust value: no state');
});

test('only the features of the device as created in Gladys', () => {
  const created = new Set(['ext:test-integration:station:IGLADYS42:humidity']);
  assert.deepEqual(stationStates(gladys, station, full, NOW, created), [
    { device_feature_external_id: 'ext:test-integration:station:IGLADYS42:humidity', state: 63 },
  ]);
});

test('stale beyond 30 minutes', () => {
  assert.equal(isStale(full, NOW), false);
  assert.equal(isStale(full, full.observedAt + 30 * 60000), false);
  assert.equal(isStale(full, full.observedAt + 31 * 60000), true);
  assert.equal(isStale({ observedAt: null }, NOW), true);
});
