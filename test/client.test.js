// -----------------------------------------------------------------------------
// The API client: the request it sends, and how it reads each documented
// answer (200, 204, 401, 429, 400, 5xx, network). The key never appears in
// an error message.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  API_URL,
  ERROR_KINDS,
  WuApiError,
  fetchObservation,
  observationUrl,
} from '../src/wu/client.js';
import { API_KEY, createFakeApi, fixture, observation } from './helpers/world.js';

const read = (api, stationId = 'IGLADYS42', apiKey = API_KEY) =>
  fetchObservation({ apiKey, stationId, fetch: api.fetch });

/** The error a call rejects with. */
async function failure(promise) {
  try {
    await promise;
  } catch (err) {
    return err;
  }
  assert.fail('expected a rejection');
}

test('the request asks for the metric units with decimals, the station as typed', () => {
  const url = new URL(observationUrl(API_KEY, 'iGladys42'));
  assert.equal(`${url.origin}${url.pathname}`, API_URL);
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    stationId: 'iGladys42',
    format: 'json',
    units: 'm',
    numericPrecision: 'decimal',
    apiKey: API_KEY,
  });
});

test('a 200 resolves with the first observation', async () => {
  const api = createFakeApi({ IGLADYS42: observation() });
  assert.deepEqual(await read(api), fixture('current-full.json').observations[0]);
  assert.equal(api.calls.length, 1);
});

test('a 204 (no record in the last hour, or unknown id) resolves with null', async () => {
  assert.equal(await read(createFakeApi({})), null);
});

test('a refused key is an AUTH error carrying the API code, never the key', async () => {
  const err = await failure(read(createFakeApi({}), 'IGLADYS42', 'wrong-key-0000'));
  assert.ok(err instanceof WuApiError);
  assert.equal(err.kind, ERROR_KINDS.AUTH);
  assert.equal(err.status, 401);
  assert.equal(err.code, 'CDN-0001');
  assert.match(err.message, /API key refused \(HTTP 401, CDN-0001\)/);
  assert.doesNotMatch(err.message, /wrong-key/);
});

test('each HTTP status maps to its kind', async () => {
  const cases = [
    [403, ERROR_KINDS.AUTH],
    [429, ERROR_KINDS.RATE_LIMIT],
    [400, ERROR_KINDS.BAD_REQUEST],
    [404, ERROR_KINDS.BAD_REQUEST],
    [500, ERROR_KINDS.SERVER],
    [503, ERROR_KINDS.SERVER],
  ];
  for (const [status, kind] of cases) {
    const api = createFakeApi({ IGLADYS42: { status, body: 'nope' } });
    const err = await failure(read(api));
    assert.equal(err.kind, kind, `HTTP ${status}`);
    assert.equal(err.status, status);
    assert.doesNotMatch(err.message, new RegExp(API_KEY));
  }
});

test('a 200 without observation, or not JSON, is an invalid response', async () => {
  for (const body of ['{"observations":[]}', '<html>maintenance</html>', '']) {
    const api = createFakeApi({ IGLADYS42: { status: 200, body } });
    const err = await failure(read(api));
    assert.equal(err.kind, ERROR_KINDS.INVALID_RESPONSE, body);
  }
});

test('a network failure or a timeout is a NETWORK error, without the URL', async () => {
  const api = createFakeApi({});
  api.fail = 'ENOTFOUND';
  const err = await failure(read(api));
  assert.equal(err.kind, ERROR_KINDS.NETWORK);
  assert.equal(err.message, 'api.weather.com unreachable (ENOTFOUND)');

  const hanging = (url, { signal }) =>
    new Promise((resolve, reject) => {
      signal.addEventListener('abort', () => reject(signal.reason));
    });
  // AbortSignal.timeout does not hold the event loop: this timer does.
  const keepAlive = setTimeout(() => {}, 1000);
  const timeout = await failure(
    fetchObservation({ apiKey: API_KEY, stationId: 'X1', fetch: hanging, timeoutMs: 20 }),
  );
  clearTimeout(keepAlive);
  assert.equal(timeout.kind, ERROR_KINDS.NETWORK);
  assert.match(timeout.message, /no answer within/);
});
