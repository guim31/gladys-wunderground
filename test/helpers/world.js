// -----------------------------------------------------------------------------
// A complete test world: the SDK's fake Gladys, a fake Weather Company API
// serving the fixtures, and the integration wired on top through
// registerHandlers. No network.
// -----------------------------------------------------------------------------

import { readFileSync } from 'node:fs';
import { createFakeGladys } from '@gladysassistant/integration-sdk/testing';
import { registerHandlers } from '../../src/app.js';

// The integration logs its lifecycle; keep the test output readable
// (LOG_LEVEL is read on every log call). LOG_LEVEL=debug npm test shows them.
process.env.LOG_LEVEL ??= 'silent';

export const fixture = (name) =>
  JSON.parse(readFileSync(new URL(`../fixtures/wu/${name}`, import.meta.url), 'utf8'));

export const API_KEY = '0123456789abcdef0123456789abcdef';

/** The raw observation of a fixture, with another id or values if asked. */
export function observation(name = 'current-full.json', overrides = {}) {
  const raw = fixture(name).observations[0];
  const { metric, ...rest } = overrides;
  return { ...raw, ...rest, metric: { ...raw.metric, ...metric } };
}

// 3 minutes after the observation of current-full.json.
export const NOW = Date.parse('2026-10-15T12:08:12Z');

/**
 * A fake api.weather.com. `stations` maps a station id (as sent) to what the
 * API answers: a raw observation, `null` (204), or `{ status, body }`.
 * `fail` makes every request throw (network down).
 */
export function createFakeApi(stations = {}) {
  const api = {
    stations,
    calls: [],
    fail: null,
    async fetch(url) {
      const parsed = new URL(url);
      const query = Object.fromEntries(parsed.searchParams);
      api.calls.push(query);
      if (api.fail) {
        const err = new TypeError('fetch failed');
        err.cause = { code: api.fail };
        throw err;
      }
      if (query.apiKey !== API_KEY) {
        return new Response(JSON.stringify(fixture('error-401.json')), { status: 401 });
      }
      const answer = api.stations[query.stationId];
      if (answer === undefined || answer === null) {
        return new Response(null, { status: 204 });
      }
      if (answer.status) {
        const body = typeof answer.body === 'string' ? answer.body : JSON.stringify(answer.body);
        return new Response(body ?? null, { status: answer.status });
      }
      return new Response(JSON.stringify({ observations: [answer] }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      });
    },
    /** Number of calls for one station. */
    callsFor(stationId) {
      return api.calls.filter((q) => q.stationId === stationId).length;
    },
  };
  return api;
}

/**
 * @param {object} [options]
 * @param {object} [options.config] raw integration config
 * @param {object} [options.stations] see createFakeApi
 * @param {Array} [options.devices] devices already created in Gladys
 * @param {{ value: number }} [options.clock] mutable time
 * @param {boolean} [options.connect]
 * @param {boolean} [options.timers]
 * @param {number} [options.periodMs]
 */
export async function createWorld({
  config = {},
  stations = { IGLADYS42: observation() },
  devices = [],
  clock = { value: NOW },
  connect = true,
  timers = false,
  periodMs,
} = {}) {
  const api = createFakeApi(stations);
  const gladys = createFakeGladys({
    config: { api_key: API_KEY, station_ids: 'IGLADYS42', ...config },
    devices,
  });
  const app = registerHandlers(gladys, {
    fetch: api.fetch,
    now: () => clock.value,
    timers,
    periodMs,
  });
  if (connect) {
    await gladys.connect();
    await app.ready;
  }
  return { gladys, api, app, hub: app.hub, clock };
}

/** Add every discovered device to Gladys, as the user would. */
export async function createAll(world) {
  for (const device of world.gladys.fake.discoveredDevices) {
    await world.gladys.fake.deviceCreated(structuredClone(device));
  }
}

/** External id of the device of a station, and of its features. */
export const ids = (gladys, platformId = 'IGLADYS42') => gladys.externalIds('station', platformId);
