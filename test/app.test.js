// -----------------------------------------------------------------------------
// The integration end to end, on the SDK's fake Gladys and a fake API:
// start, devices added, stale stations, errors, quota, reconnection, the
// "Test the connection" action.
// -----------------------------------------------------------------------------

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STATUS } from '../src/i18n.js';
import { HEARTBEAT_MS, RATE_LIMIT_BACKOFF_MS } from '../src/hub.js';
import { API_KEY, NOW, createAll, createWorld, ids, observation } from './helpers/world.js';

const temperatureOf = (gladys, id = 'IGLADYS42') =>
  gladys.fake.lastState(ids(gladys, id).feature('temperature'));
const ageOf = (gladys, id = 'IGLADYS42') =>
  gladys.fake.lastState(ids(gladys, id).feature('observation_age'));

test('not configured: a status that says what to fill in, no API call', async () => {
  const { gladys, api, app } = await createWorld({ config: { api_key: '', station_ids: '' } });
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.notConfigured,
  });
  assert.equal(api.calls.length, 0);
  assert.deepEqual(gladys.fake.discoveredDevices, []);
  await app.stop();
});

test('start: one read per station, the devices published, connected', async () => {
  const { gladys, api, app } = await createWorld({
    config: { station_ids: 'IGLADYS42, IGLADYS7' },
    stations: { IGLADYS42: observation(), IGLADYS7: observation('current-minimal.json') },
  });
  assert.equal(api.calls.length, 2);
  assert.deepEqual(
    gladys.fake.discoveredDevices.map((d) => d.name),
    ['Les Chartreux (IGLADYS42)', 'Weather Underground IGLADYS7'],
  );
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  // Nothing added yet in Gladys: no state, no badge.
  assert.equal(gladys.fake.states.length, 0);
  assert.equal(gladys.fake.transports.length, 0);
  await app.stop();
});

test('a station added in Gladys gets every state at once, from the last read', async () => {
  const world = await createWorld();
  const { gladys, api, app } = world;
  await createAll(world);
  assert.equal(api.calls.length, 1, 'served from the observation read at start');
  assert.equal(temperatureOf(gladys), 17.4);
  assert.equal(ageOf(gladys), 3);
  assert.equal(gladys.fake.states.length, 13);
  assert.deepEqual(gladys.fake.transports, [
    { device_external_id: ids(gladys).device, transport: 'cloud' },
  ]);
  assert.ok(gladys.fake.widgetRefreshes.includes('station'));
  await app.stop();
});

test('a device created without its states known reads the station once', async () => {
  const world = await createWorld({ stations: {} });
  await createAll(world);
  assert.equal(world.api.calls.length, 2, 'start (204), then the device creation');
  world.api.stations.IGLADYS42 = observation();
  await world.gladys.fake.deviceUpdated(structuredClone(world.gladys.fake.devices[0]));
  assert.equal(world.api.calls.length, 3);
  assert.equal(temperatureOf(world.gladys), 17.4);
  await world.app.stop();
});

test('a poll publishes only what changed, and the heartbeat re-sends the rest', async (t) => {
  // The SDK dates its heartbeat with Date.now(): one clock for both.
  t.mock.timers.enable({ apis: ['Date'], now: NOW });
  const clock = {
    get value() {
      return Date.now();
    },
    set value(time) {
      t.mock.timers.setTime(time);
    },
  };
  const world = await createWorld({ clock });
  const { gladys, api, hub, app } = world;
  await createAll(world);
  const before = gladys.fake.states.length;

  // Five minutes later, a new observation: only the temperature and the age moved.
  clock.value += 5 * 60000;
  api.stations.IGLADYS42 = observation('current-full.json', {
    obsTimeUtc: '2026-10-15T12:12:00Z',
    metric: { temp: 17.9, heatIndex: 17.9, windChill: 17.9 },
  });
  await app.poller.cycle();
  const sent = gladys.fake.states.slice(before).map((s) => s.device_feature_external_id);
  assert.deepEqual(sent.map((id) => id.split(':').pop()).sort(), [
    'feels_like',
    'observation_age',
    'temperature',
  ]);
  assert.equal(ageOf(gladys), 1);

  // Seven hours of the same observation would be stale; the heartbeat is
  // checked on a fresh one.
  clock.value += HEARTBEAT_MS + 60000;
  api.stations.IGLADYS42 = observation('current-full.json', {
    obsTimeUtc: new Date(clock.value - 2 * 60000).toISOString(),
    metric: { temp: 17.9, heatIndex: 17.9, windChill: 17.9 },
  });
  const beforeHeartbeat = gladys.fake.states.length;
  await app.poller.cycle();
  assert.equal(gladys.fake.states.length - beforeHeartbeat, 13, 'everything re-sent');
  assert.equal(hub.cache.size, 1);
  await app.stop();
});

test('a silent station: only its age moves, the badge says why, values are not re-sent', async () => {
  const clock = { value: NOW };
  const world = await createWorld({ clock });
  const { gladys, api, app } = world;
  await createAll(world);

  // The station stops uploading: the API answers 204 after an hour.
  api.stations.IGLADYS42 = null;
  clock.value += 40 * 60000;
  const before = gladys.fake.states.length;
  await app.poller.cycle();
  assert.deepEqual(
    gladys.fake.states
      .slice(before)
      .map((s) => ({ id: s.device_feature_external_id, state: s.state })),
    [{ id: ids(gladys).feature('observation_age'), state: 43 }],
  );
  const badge = gladys.fake.transports.at(-1);
  assert.equal(badge.transport, 'cloud');
  assert.equal(badge.degraded, true);
  assert.match(badge.message.fr, /n'envoie plus/);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true }, 'the key works');

  // Long after: still no stale value re-sent by the heartbeat.
  clock.value += HEARTBEAT_MS * 2;
  const later = gladys.fake.states.length;
  await app.poller.cycle();
  assert.deepEqual(
    gladys.fake.states.slice(later).map((s) => s.device_feature_external_id),
    [ids(gladys).feature('observation_age')],
  );

  // It comes back: everything again, the badge back to nominal.
  clock.value += 5 * 60000;
  api.stations.IGLADYS42 = observation('current-full.json', {
    obsTimeUtc: new Date(clock.value - 60000).toISOString(),
  });
  await app.poller.cycle();
  assert.equal(ageOf(gladys), 1);
  assert.deepEqual(gladys.fake.transports.at(-1), {
    device_external_id: ids(gladys).device,
    transport: 'cloud',
  });
  await app.stop();
});

test('a refused key: the status says so, the reads pause for an hour', async () => {
  const clock = { value: NOW };
  const world = await createWorld({ clock, config: { api_key: 'not-the-key' } });
  const { gladys, api, app } = world;
  assert.deepEqual(gladys.fake.connectionStatus, { connected: false, message: STATUS.authFailed });
  assert.deepEqual(gladys.fake.discoveredDevices, [], 'nothing published with a refused key');
  assert.equal(api.calls.length, 1);
  clock.value += 30 * 60000;
  await gladys.fake.poll({ external_id: ids(gladys).device });
  assert.equal(api.calls.length, 1, 'no call while backing off');

  // The user fixes the key.
  await gladys.fake.configUpdated({ api_key: API_KEY, station_ids: 'IGLADYS42' });
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  assert.equal(gladys.fake.discoveredDevices.length, 1);
  await app.stop();
});

test('quota exceeded: the reads pause 15 minutes, then resume', async () => {
  const clock = { value: NOW };
  const world = await createWorld({ clock });
  const { gladys, api, app } = world;
  await createAll(world);
  api.stations.IGLADYS42 = { status: 429, body: { errors: [{ error: { code: 'RATE-1' } }] } };
  clock.value += 5 * 60000;
  await app.poller.cycle();
  assert.deepEqual(gladys.fake.connectionStatus, {
    connected: false,
    message: STATUS.rateLimited,
  });
  const calls = api.calls.length;
  clock.value += 5 * 60000;
  await app.poller.cycle();
  assert.equal(api.calls.length, calls, 'paused');
  api.stations.IGLADYS42 = observation('current-full.json', {
    obsTimeUtc: new Date(clock.value + RATE_LIMIT_BACKOFF_MS).toISOString(),
  });
  clock.value += RATE_LIMIT_BACKOFF_MS;
  await app.poller.cycle();
  assert.equal(api.calls.length, calls + 1);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  await app.stop();
});

test('the API unreachable: the badge turns unreachable, the status says it', async () => {
  const clock = { value: NOW };
  const world = await createWorld({ clock });
  const { gladys, api, app } = world;
  await createAll(world);
  api.fail = 'ECONNRESET';
  clock.value += 5 * 60000;
  await app.poller.cycle();
  assert.equal(gladys.fake.transports.at(-1).transport, 'unreachable');
  assert.deepEqual(gladys.fake.connectionStatus, { connected: false, message: STATUS.unreachable });
  api.fail = null;
  clock.value += 5 * 60000;
  await app.poller.cycle();
  assert.equal(gladys.fake.transports.at(-1).transport, 'cloud');
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  await app.stop();
});

test("the core's onPoll inside the period is served from the last read", async () => {
  const clock = { value: NOW };
  const world = await createWorld({ clock });
  const { gladys, api, app } = world;
  await createAll(world);
  const device = gladys.fake.devices[0];
  for (let minute = 1; minute <= 4; minute += 1) {
    clock.value += 60000;
    assert.deepEqual(await gladys.fake.poll(device), { success: true });
  }
  assert.equal(api.calls.length, 1, 'no read within 90 % of 5 minutes');
  assert.equal(ageOf(gladys), 7, 'the age still moves');
  clock.value += 60000;
  await gladys.fake.poll(device);
  assert.equal(api.calls.length, 2, 'the timer stalled: the core takes over');
  await app.stop();
});

test('a reconnection re-sends the states and the status from the cache', async () => {
  const world = await createWorld();
  const { gladys, api, app } = world;
  await createAll(world);
  const states = gladys.fake.states.length;
  await gladys.disconnect();
  await gladys.connect();
  assert.equal(api.calls.length, 1, 'no new read');
  assert.equal(gladys.fake.states.length - states, 13);
  assert.deepEqual(gladys.fake.connectionStatus, { connected: true });
  await app.stop();
});

test('a scan reuses an observation younger than half a period', async () => {
  const clock = { value: NOW };
  const world = await createWorld({ clock });
  await world.gladys.fake.scanRequest();
  assert.equal(world.api.calls.length, 1);
  clock.value += 3 * 60000;
  await world.gladys.fake.scanRequest();
  assert.equal(world.api.calls.length, 2);
  await world.app.stop();
});

test('Test the connection: one line per station, in every language', async () => {
  const world = await createWorld({
    config: { station_ids: 'IGLADYS42, IGLADYS99, IBAD1, not-an-id' },
    stations: { IGLADYS42: observation(), IBAD1: { status: 400, body: '' } },
  });
  const { gladys, api, app } = world;
  const calls = api.calls.length;
  const ack = await gladys.fake.action('test_connection');
  assert.equal(ack.success, true);
  assert.equal(api.calls.length - calls, 3);
  assert.equal(
    ack.data.message.en,
    [
      'IGLADYS42: OK, 17.4 °C, 3 min ago.',
      'IGLADYS99: no observation in the last hour (offline station or unknown id).',
      'IBAD1: id refused by the API.',
      'Ignored, not a station id: not-an-id.',
      'Each station is read every 5 min.',
    ].join('\n'),
  );
  assert.match(ack.data.message.fr, /^IGLADYS42 : OK, 17,4 °C, il y a 3 min\./);
  assert.match(ack.data.message.de, /^IGLADYS42: OK, 17,4 °C, vor 3 Min\./);
  assert.match(ack.data.message.es, /^IGLADYS42: OK, 17,4 °C, hace 3 min\./);

  const refused = await createWorld({ config: { api_key: 'nope' } });
  const report = await refused.gladys.fake.action('test_connection');
  assert.equal(report.data.message.en, STATUS.authFailed.en);
  await refused.app.stop();
  await app.stop();
});
