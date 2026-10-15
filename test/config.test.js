// -----------------------------------------------------------------------------
// Configuration: normalization, the station list, the pace the quota allows.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  DAILY_CALL_BUDGET,
  DEFAULT_CONFIG,
  MAX_STATIONS,
  isConfigured,
  normalizeConfig,
  parseStations,
  refreshMinutes,
} from '../src/config.js';

test('defaults, types and unknown values', () => {
  assert.deepEqual(normalizeConfig(), DEFAULT_CONFIG);
  assert.deepEqual(
    normalizeConfig({ api_key: '  key ', refresh_minutes: 10, language: 'it', other: 1 }),
    { api_key: 'key', station_ids: '', refresh_minutes: '10', language: 'fr' },
  );
  assert.equal(normalizeConfig({ refresh_minutes: '7' }).refresh_minutes, '5');
  assert.equal(normalizeConfig({ language: 'es' }).language, 'es');
});

test('station ids: separators, duplicates whatever the case, typos, the cap', () => {
  const { stations, invalid, ignored } = parseStations({
    station_ids: ' IPARIS123, iparis123;KCASANFR1234\nILYON4 https://x/IPARIS9 ,,',
  });
  assert.deepEqual(stations, [
    { id: 'IPARIS123', platformId: 'IPARIS123' },
    { id: 'KCASANFR1234', platformId: 'KCASANFR1234' },
    { id: 'ILYON4', platformId: 'ILYON4' },
  ]);
  assert.deepEqual(invalid, ['https://x/IPARIS9']);
  assert.deepEqual(ignored, []);

  const many = Array.from({ length: 12 }, (_, i) => `ISTATION${i}`).join(',');
  const capped = parseStations({ station_ids: many });
  assert.equal(capped.stations.length, MAX_STATIONS);
  assert.deepEqual(capped.ignored, ['ISTATION10', 'ISTATION11']);
});

test('the id typed in lower case keeps its case for the API, not for the device', () => {
  assert.deepEqual(parseStations({ station_ids: 'iGladys42' }).stations, [
    { id: 'iGladys42', platformId: 'IGLADYS42' },
  ]);
});

test('configured: a key and at least one valid station', () => {
  assert.equal(isConfigured(normalizeConfig({ api_key: 'k', station_ids: 'IPARIS1' })), true);
  assert.equal(isConfigured(normalizeConfig({ api_key: 'k', station_ids: 'a b' })), false);
  assert.equal(isConfigured(normalizeConfig({ station_ids: 'IPARIS1' })), false);
});

test('the pace stays under the daily budget whatever the number of stations', () => {
  const config = normalizeConfig({ refresh_minutes: '5' });
  assert.equal(refreshMinutes(config, 1), 5);
  assert.equal(refreshMinutes(config, 4), 5);
  assert.equal(refreshMinutes(config, 5), 6);
  assert.equal(refreshMinutes(config, 10), 11);
  assert.equal(refreshMinutes(normalizeConfig({ refresh_minutes: '30' }), 10), 30);
  for (let count = 1; count <= MAX_STATIONS; count += 1) {
    const perDay = count * Math.floor((24 * 60) / refreshMinutes(config, count));
    assert.ok(perDay <= DAILY_CALL_BUDGET, `${count} stations: ${perDay} calls a day`);
    assert.ok(DAILY_CALL_BUDGET < 1500, 'a margin under the 1,500 calls of the key');
  }
});
