// -----------------------------------------------------------------------------
// From the API observation to the values the integration publishes.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LUX_PER_WATT_PER_SQUARE_METER,
  ageMinutes,
  cardinal,
  feelsLike,
  parseObservation,
} from '../src/wu/observation.js';
import { NOW, observation } from './helpers/world.js';

test('a complete observation', () => {
  const o = parseObservation(observation('current-full.json'));
  assert.deepEqual(o, {
    stationId: 'IGLADYS42',
    neighborhood: 'Les Chartreux',
    country: 'FR',
    softwareType: 'EasyWeatherPro_V5.1.6',
    observedAt: Date.parse('2026-10-15T12:05:12Z'),
    observedAtLocal: '2026-10-15 14:05:12',
    qcStatus: 1,
    temperature: 17.4,
    dewPoint: 10.3,
    feelsLike: 17.4,
    humidity: 63,
    windSpeed: 11.2,
    windGust: 19.8,
    windDirection: 247,
    pressure: 1016.93,
    rainRate: 0,
    rainToday: 2.4,
    uvIndex: 3,
    solarRadiation: 412.6,
    illuminance: 52276,
    elevation: 52.1,
  });
  assert.equal(ageMinutes(o, NOW), 3);
});

test('a station without wind, rain, UV nor solar sensor: null, never 0', () => {
  const o = parseObservation(observation('current-minimal.json'));
  for (const key of ['windSpeed', 'windGust', 'windDirection', 'rainRate', 'rainToday']) {
    assert.equal(o[key], null, key);
  }
  assert.equal(o.uvIndex, null);
  assert.equal(o.solarRadiation, null);
  assert.equal(o.illuminance, null);
  assert.equal(o.neighborhood, null, 'an empty neighborhood is no neighborhood');
  assert.equal(o.qcStatus, -1);
});

test('the feels-like temperature follows the wind chill and the heat index', () => {
  assert.equal(parseObservation(observation('current-winter.json')).feelsLike, -9.6);
  assert.equal(feelsLike(32, 36.5, 32), 36.5);
  assert.equal(feelsLike(20, 20, 20), 20);
  assert.equal(feelsLike(20, null, null), 20);
  assert.equal(feelsLike(null, 30, 10), null);
});

test('solar radiation in lux, with the Ecowitt factor', () => {
  assert.equal(LUX_PER_WATT_PER_SQUARE_METER, 126.7);
  const o = parseObservation(observation('current-full.json', { solarRadiation: 0 }));
  assert.equal(o.illuminance, 0);
});

test('the time falls back on the epoch, and an unparseable time gives no age', () => {
  const fromEpoch = parseObservation(observation('current-full.json', { obsTimeUtc: 'nope' }));
  assert.equal(fromEpoch.observedAt, 1792065912000);
  const none = parseObservation(
    observation('current-full.json', { obsTimeUtc: null, epoch: null }),
  );
  assert.equal(none.observedAt, null);
  assert.equal(ageMinutes(none, NOW), null);
  assert.equal(ageMinutes(null, NOW), null);
  // A clock behind the station's: never a negative age.
  assert.equal(ageMinutes(fromEpoch, fromEpoch.observedAt - 120000), 0);
});

test('values sent as strings or missing metric block', () => {
  const o = parseObservation({ ...observation(), humidity: '64', metric: undefined, winddir: 360 });
  assert.equal(o.humidity, 64);
  assert.equal(o.temperature, null);
  assert.equal(o.windDirection, 0);
});

test('the 16-point compass', () => {
  assert.equal(cardinal(0), 'N');
  assert.equal(cardinal(11), 'N');
  assert.equal(cardinal(12), 'NNE');
  assert.equal(cardinal(247), 'WSW');
  assert.equal(cardinal(350), 'N');
  assert.equal(cardinal(-90), 'W');
  assert.equal(cardinal(null), null);
});
